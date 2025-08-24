"""
WebSocket-specific board isolation tests.
Tests that WebSocket connections and broadcasts are properly isolated by board.
"""

import asyncio
import json
import logging
from typing import Any

import pytest
import websockets
from httpx import AsyncClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:18000"
WS_URL = "ws://localhost:18000/ws/connect"


class WebSocketBoardClient:
    """WebSocket client for board-specific testing."""

    def __init__(self, board_id: int):
        self.board_id = board_id
        self.messages: list[dict[str, Any]] = []
        self.websocket: websockets.WebSocketClientProtocol | None = None
        self.connected = False

    async def connect(self):
        """Connect to WebSocket and join board room."""
        try:
            self.websocket = await websockets.connect(WS_URL)
            self.connected = True

            # Join board-specific room
            await self.websocket.send(json.dumps({"type": "join_board", "board_id": self.board_id}))

            logger.info(f"WebSocket client connected for board {self.board_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect WebSocket for board {self.board_id}: {e}")
            return False

    async def listen(self, duration: float = 5.0):
        """Listen for messages for a specified duration."""
        if not self.websocket:
            return

        end_time = asyncio.get_event_loop().time() + duration

        while asyncio.get_event_loop().time() < end_time:
            try:
                remaining = end_time - asyncio.get_event_loop().time()
                if remaining <= 0:
                    break

                message = await asyncio.wait_for(self.websocket.recv(), timeout=min(remaining, 1.0))
                msg_data = json.loads(message)
                self.messages.append(msg_data)
                logger.info(f"Board {self.board_id} received: {msg_data.get('type', 'unknown')}")
            except TimeoutError:
                continue
            except websockets.exceptions.ConnectionClosed:
                logger.warning(f"WebSocket connection closed for board {self.board_id}")
                break
            except Exception as e:
                logger.error(f"Error listening on board {self.board_id}: {e}")
                break

    async def disconnect(self):
        """Disconnect WebSocket."""
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info(f"WebSocket client disconnected for board {self.board_id}")

    def get_messages_by_type(self, msg_type: str) -> list[dict[str, Any]]:
        """Get all messages of a specific type."""
        return [msg for msg in self.messages if msg.get("type") == msg_type]


class TestWebSocketBoardIsolation:
    """Test suite for WebSocket board isolation."""

    @pytest.fixture
    async def setup_test_boards(self, async_client: AsyncClient):
        """Create test boards for WebSocket testing."""
        boards = []

        for i in range(1, 4):
            response = await async_client.post(
                f"{BASE_URL}/api/boards/",
                json={
                    "name": f"WebSocket Test Board {i}",
                    "description": f"Testing WebSocket isolation - Board {i}",
                    "columns": ["Not Started", "In Progress", "Done"],
                },
            )
            assert response.status_code == 201
            boards.append(response.json())
            logger.info(f"Created test board {i}: {boards[-1]['id']}")

        yield boards

        # Cleanup
        for board in boards:
            try:
                await async_client.delete(f"{BASE_URL}/api/boards/{board['id']}")
            except:
                pass

    @pytest.mark.asyncio
    async def test_websocket_join_board_isolation(
        self, async_client: AsyncClient, setup_test_boards
    ):
        """Test that WebSocket clients only receive messages for their joined board."""
        boards = setup_test_boards

        # Create WebSocket clients for each board
        clients = [WebSocketBoardClient(board["id"]) for board in boards]

        # Connect all clients
        for client in clients:
            assert await client.connect()

        # Start listening tasks
        listen_tasks = [asyncio.create_task(client.listen(duration=10)) for client in clients]

        # Wait for connections to stabilize
        await asyncio.sleep(1)

        # Create tickets in different boards
        for i, board in enumerate(boards):
            response = await async_client.post(
                f"{BASE_URL}/api/tickets/",
                json={
                    "title": f"WS Test Ticket for Board {board['id']}",
                    "description": f"Testing WebSocket isolation for board {board['id']}",
                    "board_id": board["id"],
                    "current_column": "Not Started",
                },
            )
            assert response.status_code == 201
            logger.info(f"Created ticket in board {board['id']}")

            # Small delay between creations
            await asyncio.sleep(0.5)

        # Wait for messages to propagate
        await asyncio.sleep(2)

        # Cancel listening tasks
        for task in listen_tasks:
            task.cancel()

        # Disconnect all clients
        for client in clients:
            await client.disconnect()

        # Verify each client only received messages for its board
        for i, client in enumerate(clients):
            board_id = boards[i]["id"]
            ticket_created_messages = client.get_messages_by_type("ticket_created")

            for msg in ticket_created_messages:
                msg_board_id = msg.get("data", {}).get("board_id")
                assert msg_board_id == board_id, (
                    f"Board {board_id} client received message for board {msg_board_id}"
                )

            logger.info(
                f"Board {board_id} client received {len(ticket_created_messages)} ticket_created messages"
            )

    @pytest.mark.asyncio
    async def test_websocket_ticket_move_broadcast_isolation(
        self, async_client: AsyncClient, setup_test_boards
    ):
        """Test that ticket move events are only broadcast to the correct board."""
        boards = setup_test_boards

        # Create tickets in each board
        tickets = {}
        for board in boards:
            response = await async_client.post(
                f"{BASE_URL}/api/tickets/",
                json={
                    "title": f"Move Test Ticket for Board {board['id']}",
                    "description": "Testing move broadcast isolation",
                    "board_id": board["id"],
                    "current_column": "Not Started",
                },
            )
            assert response.status_code == 201
            tickets[board["id"]] = response.json()

        # Create WebSocket clients
        clients = [WebSocketBoardClient(board["id"]) for board in boards]

        # Connect all clients
        for client in clients:
            assert await client.connect()

        # Start listening
        listen_tasks = [asyncio.create_task(client.listen(duration=10)) for client in clients]

        # Wait for connections to stabilize
        await asyncio.sleep(1)

        # Move ticket in board 1
        board1_ticket = tickets[boards[0]["id"]]
        move_response = await async_client.post(
            f"{BASE_URL}/api/tickets/{board1_ticket['id']}/move", json={"column": "In Progress"}
        )
        assert move_response.status_code == 200
        logger.info(f"Moved ticket {board1_ticket['id']} in board {boards[0]['id']}")

        # Move ticket in board 2
        board2_ticket = tickets[boards[1]["id"]]
        move_response = await async_client.post(
            f"{BASE_URL}/api/tickets/{board2_ticket['id']}/move", json={"column": "Done"}
        )
        assert move_response.status_code == 200
        logger.info(f"Moved ticket {board2_ticket['id']} in board {boards[1]['id']}")

        # Wait for broadcasts
        await asyncio.sleep(2)

        # Cancel tasks
        for task in listen_tasks:
            task.cancel()

        # Disconnect clients
        for client in clients:
            await client.disconnect()

        # Verify board 1 client only got board 1 move
        board1_moves = clients[0].get_messages_by_type("ticket_moved")
        for msg in board1_moves:
            ticket_id = msg.get("data", {}).get("id")
            assert ticket_id == board1_ticket["id"], (
                f"Board 1 client received move for ticket {ticket_id}"
            )

        # Verify board 2 client only got board 2 move
        board2_moves = clients[1].get_messages_by_type("ticket_moved")
        for msg in board2_moves:
            ticket_id = msg.get("data", {}).get("id")
            assert ticket_id == board2_ticket["id"], (
                f"Board 2 client received move for ticket {ticket_id}"
            )

        # Verify board 3 client got no moves
        board3_moves = clients[2].get_messages_by_type("ticket_moved")
        assert len(board3_moves) == 0, (
            f"Board 3 client received {len(board3_moves)} move messages (expected 0)"
        )

    @pytest.mark.asyncio
    async def test_websocket_deletion_broadcast_isolation(
        self, async_client: AsyncClient, setup_test_boards
    ):
        """Test that deletion events are only broadcast to the correct board."""
        boards = setup_test_boards

        # Create tickets to delete
        tickets = {}
        for board in boards[:2]:  # Only create in first 2 boards
            response = await async_client.post(
                f"{BASE_URL}/api/tickets/",
                json={
                    "title": f"Delete Test Ticket for Board {board['id']}",
                    "description": "Testing deletion broadcast isolation",
                    "board_id": board["id"],
                    "current_column": "Not Started",
                },
            )
            assert response.status_code == 201
            tickets[board["id"]] = response.json()

        # Create WebSocket clients
        clients = [WebSocketBoardClient(board["id"]) for board in boards]

        # Connect all clients
        for client in clients:
            assert await client.connect()

        # Start listening
        listen_tasks = [asyncio.create_task(client.listen(duration=10)) for client in clients]

        # Wait for connections
        await asyncio.sleep(1)

        # Delete ticket from board 1
        board1_ticket = tickets[boards[0]["id"]]
        delete_response = await async_client.delete(f"{BASE_URL}/api/tickets/{board1_ticket['id']}")
        assert delete_response.status_code in [200, 204]
        logger.info(f"Deleted ticket {board1_ticket['id']} from board {boards[0]['id']}")

        # Wait for broadcast
        await asyncio.sleep(2)

        # Cancel tasks
        for task in listen_tasks:
            task.cancel()

        # Disconnect clients
        for client in clients:
            await client.disconnect()

        # Verify only board 1 client received deletion
        board1_deletions = clients[0].get_messages_by_type("ticket_deleted")
        assert len(board1_deletions) > 0, "Board 1 client should receive deletion"

        board2_deletions = clients[1].get_messages_by_type("ticket_deleted")
        assert len(board2_deletions) == 0, "Board 2 client should not receive deletion"

        board3_deletions = clients[2].get_messages_by_type("ticket_deleted")
        assert len(board3_deletions) == 0, "Board 3 client should not receive deletion"

    @pytest.mark.asyncio
    async def test_websocket_concurrent_boards(self, async_client: AsyncClient, setup_test_boards):
        """Test that multiple concurrent board connections remain isolated."""
        boards = setup_test_boards

        # Create multiple clients per board (simulating multiple users)
        clients_per_board = 3
        all_clients = []

        for board in boards:
            for _ in range(clients_per_board):
                client = WebSocketBoardClient(board["id"])
                all_clients.append(client)

        # Connect all clients
        for client in all_clients:
            assert await client.connect()

        # Start listening
        listen_tasks = [asyncio.create_task(client.listen(duration=10)) for client in all_clients]

        # Wait for connections
        await asyncio.sleep(1)

        # Create rapid updates in board 1
        for i in range(5):
            response = await async_client.post(
                f"{BASE_URL}/api/tickets/",
                json={
                    "title": f"Rapid Test {i} Board {boards[0]['id']}",
                    "description": "Testing rapid updates",
                    "board_id": boards[0]["id"],
                    "current_column": "Not Started",
                },
            )
            assert response.status_code == 201
            await asyncio.sleep(0.1)

        # Create updates in board 2
        for i in range(3):
            response = await async_client.post(
                f"{BASE_URL}/api/tickets/",
                json={
                    "title": f"Concurrent Test {i} Board {boards[1]['id']}",
                    "description": "Testing concurrent updates",
                    "board_id": boards[1]["id"],
                    "current_column": "Done",
                },
            )
            assert response.status_code == 201
            await asyncio.sleep(0.2)

        # Wait for all messages
        await asyncio.sleep(2)

        # Cancel tasks
        for task in listen_tasks:
            task.cancel()

        # Disconnect all
        for client in all_clients:
            await client.disconnect()

        # Verify isolation
        # Board 1 clients (first clients_per_board clients)
        for i in range(clients_per_board):
            client = all_clients[i]
            messages = client.get_messages_by_type("ticket_created")

            for msg in messages:
                board_id = msg.get("data", {}).get("board_id")
                assert board_id == boards[0]["id"], (
                    f"Board 1 client received message for board {board_id}"
                )

        # Board 2 clients
        for i in range(clients_per_board, clients_per_board * 2):
            client = all_clients[i]
            messages = client.get_messages_by_type("ticket_created")

            for msg in messages:
                board_id = msg.get("data", {}).get("board_id")
                assert board_id == boards[1]["id"], (
                    f"Board 2 client received message for board {board_id}"
                )

        # Board 3 clients (should have no ticket_created messages)
        for i in range(clients_per_board * 2, clients_per_board * 3):
            client = all_clients[i]
            messages = client.get_messages_by_type("ticket_created")
            assert len(messages) == 0, (
                f"Board 3 client received {len(messages)} messages (expected 0)"
            )


@pytest.fixture
async def async_client():
    """Create an async HTTP client for testing."""
    async with AsyncClient() as client:
        yield client


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--asyncio-mode=auto", "-s"])
