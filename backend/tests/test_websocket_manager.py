import json
from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from app.services.websocket_manager import ConnectionManager


class TestConnectionManager:
    """Test suite for WebSocket ConnectionManager"""

    @pytest.fixture
    def manager(self):
        """Create a fresh ConnectionManager for each test"""
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket"""
        ws = AsyncMock()
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_connect_generates_client_id(self, manager, mock_websocket):
        """Test that connecting without client_id generates one"""
        client_id = await manager.connect(mock_websocket)

        assert client_id.startswith("client_")
        assert client_id in manager.active_connections
        assert client_id in manager.connection_metadata
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_connect_with_custom_client_id(self, manager, mock_websocket):
        """Test connecting with custom client_id"""
        custom_id = "test_client_123"
        client_id = await manager.connect(mock_websocket, custom_id)

        assert client_id == custom_id
        assert client_id in manager.active_connections
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_disconnect_removes_client(self, manager, mock_websocket):
        """Test that disconnect removes client from all collections"""
        client_id = await manager.connect(mock_websocket)

        # Verify client is connected
        assert client_id in manager.active_connections
        assert client_id in manager.connection_metadata

        # Disconnect
        await manager.disconnect(client_id)

        # Verify client is removed
        assert client_id not in manager.active_connections
        assert client_id not in manager.connection_metadata

    @pytest.mark.asyncio
    async def test_send_personal_message_success(self, manager, mock_websocket):
        """Test successful personal message sending"""
        client_id = await manager.connect(mock_websocket)
        message = {"type": "test", "data": "hello"}

        result = await manager.send_personal_message(message, client_id)

        assert result is True
        mock_websocket.send_text.assert_called_once_with(json.dumps(message))

    @pytest.mark.asyncio
    async def test_send_personal_message_nonexistent_client(self, manager):
        """Test sending message to non-existent client"""
        message = {"type": "test", "data": "hello"}

        result = await manager.send_personal_message(message, "nonexistent")

        assert result is False

    @pytest.mark.asyncio
    async def test_send_personal_message_failure_disconnects(self, manager, mock_websocket):
        """Test that send failure triggers disconnect"""
        client_id = await manager.connect(mock_websocket)
        mock_websocket.send_text.side_effect = Exception("Connection lost")

        result = await manager.send_personal_message({"test": "data"}, client_id)

        assert result is False
        assert client_id not in manager.active_connections

    @pytest.mark.asyncio
    async def test_broadcast_to_multiple_clients(self, manager):
        """Test broadcasting to multiple clients"""
        # Connect multiple clients
        ws1, ws2, ws3 = AsyncMock(), AsyncMock(), AsyncMock()
        await manager.connect(ws1)
        await manager.connect(ws2)
        await manager.connect(ws3)

        message = {"event": "test_broadcast", "data": "hello all"}

        # Broadcast
        count = await manager.broadcast(message)

        assert count == 3
        expected_json = json.dumps(message)
        ws1.send_text.assert_called_once_with(expected_json)
        ws2.send_text.assert_called_once_with(expected_json)
        ws3.send_text.assert_called_once_with(expected_json)

    @pytest.mark.asyncio
    async def test_broadcast_excludes_clients(self, manager):
        """Test broadcast with excluded clients"""
        ws1, ws2, ws3 = AsyncMock(), AsyncMock(), AsyncMock()
        await manager.connect(ws1)
        client2 = await manager.connect(ws2)
        await manager.connect(ws3)

        message = {"event": "test", "data": "hello"}
        exclude_clients = {client2}

        count = await manager.broadcast(message, exclude_clients)

        assert count == 2
        ws1.send_text.assert_called_once()
        ws2.send_text.assert_not_called()
        ws3.send_text.assert_called_once()

    @pytest.mark.asyncio
    async def test_broadcast_handles_failed_connections(self, manager):
        """Test broadcast removes failed connections"""
        ws1, ws2, ws3 = AsyncMock(), AsyncMock(), AsyncMock()
        client1 = await manager.connect(ws1)
        client2 = await manager.connect(ws2)
        client3 = await manager.connect(ws3)

        # Make client2 fail
        ws2.send_text.side_effect = Exception("Connection failed")

        message = {"event": "test", "data": "hello"}
        count = await manager.broadcast(message)

        # Should send to 2 clients (1 and 3), client2 should be disconnected
        assert count == 2
        assert client1 in manager.active_connections
        assert client2 not in manager.active_connections
        assert client3 in manager.active_connections

    def test_get_connection_count(self, manager):
        """Test connection count tracking"""
        assert manager.get_connection_count() == 0

    @pytest.mark.asyncio
    async def test_get_connection_stats(self, manager, mock_websocket):
        """Test connection statistics"""
        client_id = await manager.connect(mock_websocket)

        # Send some messages to update stats
        await manager.send_personal_message({"test": 1}, client_id)
        await manager.send_personal_message({"test": 2}, client_id)

        stats = manager.get_connection_stats()

        assert stats["total_connections"] == 1
        assert stats["total_messages_sent"] == 2
        assert len(stats["connections"]) == 1

        client_stats = stats["connections"][0]
        assert client_stats["client_id"] == client_id
        assert client_stats["message_count"] == 2
        assert "connected_duration_seconds" in client_stats
        assert "last_activity" in client_stats

    @pytest.mark.asyncio
    async def test_cleanup_inactive_connections(self, manager, mock_websocket):
        """Test cleanup of inactive connections"""
        client_id = await manager.connect(mock_websocket)

        # Manually set last_activity to old time
        old_time = datetime.utcnow()
        manager.connection_metadata[client_id]["last_activity"] = old_time

        # Clean up connections older than 0 seconds (should remove all)
        await manager.cleanup_inactive_connections(timeout_seconds=0)

        assert client_id not in manager.active_connections
        assert client_id not in manager.connection_metadata

    @pytest.mark.asyncio
    async def test_broadcast_to_board(self, manager, mock_websocket):
        """Test board-specific broadcasting"""
        await manager.connect(mock_websocket)

        message = {"event": "board_update", "data": "test"}
        board_id = 123

        count = await manager.broadcast_to_board(board_id, message)

        assert count == 1
        # Verify send_text was called once
        mock_websocket.send_text.assert_called_once()

        # Parse the sent message and verify structure
        sent_message = json.loads(mock_websocket.send_text.call_args[0][0])
        assert sent_message["event"] == "board_update"
        assert sent_message["data"] == "test"
        assert sent_message["board_id"] == board_id
        assert "timestamp" in sent_message
