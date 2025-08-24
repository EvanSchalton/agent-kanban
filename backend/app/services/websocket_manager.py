import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
        self.board_subscriptions: Dict[str, Set[int]] = {}  # client_id -> set of board_ids
        self._lock = asyncio.Lock()
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._heartbeat_interval = 30  # Send heartbeat every 30 seconds
        self._connection_timeout = 60  # Consider connection dead after 60 seconds without response
        self._cleanup_task: Optional[asyncio.Task] = None
        self._start_heartbeat()

    async def connect(
        self, websocket: WebSocket, client_id: Optional[str] = None, username: Optional[str] = None
    ) -> str:
        """Connect a websocket with optional client ID and username for attribution"""
        await websocket.accept()

        # Generate client ID if not provided
        if not client_id:
            client_id = f"client_{datetime.now().timestamp()}"

        async with self._lock:
            self.active_connections[client_id] = websocket
            self.connection_metadata[client_id] = {
                "connected_at": datetime.now(),
                "message_count": 0,
                "last_activity": datetime.now(),
                "last_heartbeat": None,
                "heartbeat_response_count": 0,
                "missed_heartbeats": 0,
                "username": username or "anonymous",  # Store username for attribution
            }
            self.board_subscriptions[client_id] = set()  # Initialize empty board subscriptions

            # Start heartbeat and cleanup tasks if this is the first connection
            if len(self.active_connections) == 1:
                if not self._heartbeat_task:
                    self._start_heartbeat()
                if not self._cleanup_task:
                    self._start_cleanup_task()

        logger.info(
            f"WebSocket client {client_id} connected. "
            f"Total connections: {len(self.active_connections)}"
        )
        return client_id

    async def disconnect(self, client_id: str):
        """Disconnect a specific client"""
        async with self._lock:
            if client_id in self.active_connections:
                del self.active_connections[client_id]
                metadata = self.connection_metadata.pop(client_id, {})
                self.board_subscriptions.pop(client_id, None)  # Clean up board subscriptions
                connected_duration = datetime.now() - metadata.get("connected_at", datetime.now())
                logger.info(
                    f"WebSocket client {client_id} disconnected after {connected_duration}. "
                    f"Messages sent: {metadata.get('message_count', 0)}"
                )

    async def send_personal_message(self, message: Dict[str, Any], client_id: str) -> bool:
        """Send message to specific client"""
        if client_id not in self.active_connections:
            return False

        try:
            websocket = self.active_connections[client_id]
            await websocket.send_text(json.dumps(message))

            # Update metadata
            if client_id in self.connection_metadata:
                self.connection_metadata[client_id]["last_activity"] = datetime.now()
                self.connection_metadata[client_id]["message_count"] += 1

            return True
        except Exception as e:
            logger.warning(f"Failed to send message to client {client_id}: {e}")
            await self.disconnect(client_id)
            return False

    async def broadcast(self, message: Dict[str, Any], exclude_clients: Set[str] = None) -> int:
        """Broadcast message to all connected clients with improved error handling"""
        if exclude_clients is None:
            exclude_clients = set()

        message_json = json.dumps(message)
        successful_sends = 0
        failed_clients = []

        # Create a copy of connections to avoid modification during iteration
        connections_copy = dict(self.active_connections)

        for client_id, websocket in connections_copy.items():
            if client_id in exclude_clients:
                continue

            try:
                await websocket.send_text(message_json)

                # Update metadata
                if client_id in self.connection_metadata:
                    self.connection_metadata[client_id]["last_activity"] = datetime.now()
                    self.connection_metadata[client_id]["message_count"] += 1

                successful_sends += 1
            except WebSocketDisconnect:
                failed_clients.append(client_id)
            except Exception as e:
                logger.warning(f"Failed to send broadcast to client {client_id}: {e}")
                failed_clients.append(client_id)

        # Clean up failed connections
        for client_id in failed_clients:
            await self.disconnect(client_id)

        if failed_clients:
            logger.info(
                f"Broadcast sent to {successful_sends} clients, {len(failed_clients)} disconnected"
            )

        return successful_sends

    async def subscribe_to_board(self, client_id: str, board_id: int):
        """Subscribe a client to a board"""
        async with self._lock:
            if client_id in self.board_subscriptions:
                self.board_subscriptions[client_id].add(board_id)
                logger.debug(f"Client {client_id} subscribed to board {board_id}")

    async def unsubscribe_from_board(self, client_id: str, board_id: int):
        """Unsubscribe a client from a board"""
        async with self._lock:
            if client_id in self.board_subscriptions:
                self.board_subscriptions[client_id].discard(board_id)
                logger.debug(f"Client {client_id} unsubscribed from board {board_id}")

    async def subscribe_to_all_boards(self, client_id: str):
        """Subscribe a client to all existing boards (for backward compatibility)"""
        # This is a fallback for clients that don't specify boards
        # In practice, clients should subscribe to specific boards
        async with self._lock:
            if client_id in self.board_subscriptions:
                # For now, we'll use a special sentinel value -1 to mean "all boards"
                self.board_subscriptions[client_id].add(-1)
                logger.debug(f"Client {client_id} subscribed to all boards")

    async def broadcast_to_board(
        self, board_id: int, message: Dict[str, Any], exclude_clients: Set[str] = None
    ) -> int:
        """Broadcast message to clients subscribed to a specific board with enhanced performance"""
        if exclude_clients is None:
            exclude_clients = set()

        # Enhanced message with board context
        enhanced_message = {
            **message,
            "board_id": board_id,
            "timestamp": datetime.now().isoformat(),
        }

        message_json = json.dumps(enhanced_message)
        successful_sends = 0
        failed_clients = []

        # Get board-specific connections
        connections_copy = {}
        async with self._lock:
            for client_id, websocket in self.active_connections.items():
                client_boards = self.board_subscriptions.get(client_id, set())
                # Client is subscribed if they have the specific board_id
                # or are subscribed to all (-1)
                if board_id in client_boards or -1 in client_boards:
                    connections_copy[client_id] = websocket
                elif (
                    not client_boards
                ):  # Backward compatibility: if no subscriptions, subscribe to all
                    connections_copy[client_id] = websocket

        for client_id, websocket in connections_copy.items():
            if client_id in exclude_clients:
                continue

            try:
                await websocket.send_text(message_json)

                # Update metadata
                if client_id in self.connection_metadata:
                    self.connection_metadata[client_id]["last_activity"] = datetime.now()
                    self.connection_metadata[client_id]["message_count"] += 1

                successful_sends += 1
            except WebSocketDisconnect:
                failed_clients.append(client_id)
            except Exception as e:
                logger.warning(f"Failed to send board broadcast to client {client_id}: {e}")
                failed_clients.append(client_id)

        # Clean up failed connections
        for client_id in failed_clients:
            await self.disconnect(client_id)

        if failed_clients:
            logger.info(
                f"Board {board_id} broadcast: {successful_sends} successful, "
                f"{len(failed_clients)} disconnected"
            )

        return successful_sends

    def get_connection_count(self) -> int:
        """Get current number of active connections"""
        return len(self.active_connections)

    def get_connection_stats(self) -> Dict[str, Any]:
        """Get detailed connection statistics"""
        now = datetime.now()
        total_messages = sum(
            meta.get("message_count", 0) for meta in self.connection_metadata.values()
        )

        connections_info = []
        for client_id, metadata in self.connection_metadata.items():
            duration = now - metadata.get("connected_at", now)
            connections_info.append(
                {
                    "client_id": client_id,
                    "connected_duration_seconds": duration.total_seconds(),
                    "message_count": metadata.get("message_count", 0),
                    "last_activity": metadata.get("last_activity", now).isoformat(),
                }
            )

        return {
            "total_connections": len(self.active_connections),
            "total_messages_sent": total_messages,
            "connections": connections_info,
        }

    async def batch_broadcast(
        self, messages: List[Dict[str, Any]], exclude_clients: Set[str] = None
    ) -> Dict[str, int]:
        """Efficiently broadcast multiple messages to all connections"""
        if exclude_clients is None:
            exclude_clients = set()

        results = {"successful_batches": 0, "failed_clients": 0}
        failed_clients = []

        # Pre-serialize all messages
        serialized_messages = [json.dumps(msg) for msg in messages]

        # Create a copy of connections to avoid modification during iteration
        connections_copy = dict(self.active_connections)

        for client_id, websocket in connections_copy.items():
            if client_id in exclude_clients:
                continue

            try:
                # Send all messages to this client in sequence
                for message_json in serialized_messages:
                    await websocket.send_text(message_json)

                # Update metadata for batch
                if client_id in self.connection_metadata:
                    self.connection_metadata[client_id]["last_activity"] = datetime.now()
                    self.connection_metadata[client_id]["message_count"] += len(messages)

                results["successful_batches"] += 1

            except (WebSocketDisconnect, Exception) as e:
                if not isinstance(e, WebSocketDisconnect):
                    logger.warning(f"Failed batch broadcast to client {client_id}: {e}")
                failed_clients.append(client_id)
                results["failed_clients"] += 1

        # Clean up failed connections
        for client_id in failed_clients:
            await self.disconnect(client_id)

        logger.info(
            f"Batch broadcast: {results['successful_batches']} successful, "
            f"{results['failed_clients']} failed"
        )
        return results

    async def broadcast_drag_event(
        self, board_id: int, event_type: str, ticket_data: Dict[str, Any]
    ) -> int:
        """Optimized broadcast specifically for drag-and-drop events"""
        # Use "ticket_moved" for compatibility with tests and frontend
        event_name = "ticket_moved" if event_type == "moved" else f"drag_{event_type}"
        message = {
            "event": event_name,
            "board_id": board_id,
            "timestamp": datetime.now().isoformat(),
            "data": ticket_data,
            "optimized": True,
        }

        return await self.broadcast_to_board(board_id, message)

    async def broadcast_bulk_update(self, board_id: int, updates: List[Dict[str, Any]]) -> int:
        """Optimized broadcast for bulk ticket updates"""
        message = {
            "event": "bulk_update",
            "board_id": board_id,
            "timestamp": datetime.now().isoformat(),
            "data": {"updates": updates, "count": len(updates)},
            "optimized": True,
        }

        return await self.broadcast_to_board(board_id, message)

    async def cleanup_inactive_connections(self, timeout_seconds: int = 300):
        """Clean up connections that haven't been active for a while"""
        now = datetime.now()
        inactive_clients = []

        for client_id, metadata in self.connection_metadata.items():
            last_activity = metadata.get("last_activity", now)
            if (now - last_activity).total_seconds() > timeout_seconds:
                inactive_clients.append(client_id)

        for client_id in inactive_clients:
            logger.info(f"Cleaning up inactive connection: {client_id}")
            await self.disconnect(client_id)

    def _start_heartbeat(self):
        """Start the heartbeat task"""
        try:
            loop = asyncio.get_running_loop()
            self._heartbeat_task = loop.create_task(self._heartbeat_loop())
        except RuntimeError:
            # No event loop running yet, will be started when first connection is made
            pass

    async def _heartbeat_loop(self):
        """Send periodic heartbeat to all connected clients with connection health tracking"""
        while True:
            try:
                await asyncio.sleep(self._heartbeat_interval)
                if not self.active_connections:
                    continue

                now = datetime.now()
                heartbeat_id = f"hb_{int(now.timestamp())}"
                heartbeat_message = {
                    "event": "heartbeat",
                    "heartbeat_id": heartbeat_id,
                    "timestamp": now.isoformat(),
                    "server_time": now.isoformat(),
                    "expect_response": True,
                }

                # Update heartbeat metadata for all clients
                async with self._lock:
                    for client_id in list(self.active_connections.keys()):
                        if client_id in self.connection_metadata:
                            metadata = self.connection_metadata[client_id]
                            metadata["last_heartbeat"] = now
                            metadata["missed_heartbeats"] += 1  # Will be reset when client responds

                # Send heartbeat to all clients
                successful_sends = await self.broadcast(heartbeat_message)
                logger.debug(f"Sent heartbeat {heartbeat_id} to {successful_sends} clients")

                # Check for clients with too many missed heartbeats
                await self._check_stale_connections()

            except asyncio.CancelledError:
                logger.info("Heartbeat loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in heartbeat loop: {e}")
                await asyncio.sleep(5)  # Wait before retrying

    def stop_heartbeat(self):
        """Stop the heartbeat task"""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            self._heartbeat_task = None

    def _start_cleanup_task(self):
        """Start the connection cleanup task"""
        try:
            loop = asyncio.get_running_loop()
            self._cleanup_task = loop.create_task(self._cleanup_loop())
        except RuntimeError:
            pass

    async def _cleanup_loop(self):
        """Periodic cleanup of inactive connections"""
        while True:
            try:
                await asyncio.sleep(60)  # Run cleanup every minute
                await self.cleanup_inactive_connections(self._connection_timeout)
            except asyncio.CancelledError:
                logger.info("Cleanup loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

    async def _check_stale_connections(self):
        """Check for connections that missed too many heartbeats"""
        stale_clients = []
        max_missed_heartbeats = 3

        async with self._lock:
            for client_id, metadata in self.connection_metadata.items():
                missed = metadata.get("missed_heartbeats", 0)
                if missed >= max_missed_heartbeats:
                    stale_clients.append(client_id)

        for client_id in stale_clients:
            logger.warning(
                f"Disconnecting stale client {client_id} "
                f"(missed {max_missed_heartbeats} heartbeats)"
            )
            await self.disconnect(client_id)

    async def handle_heartbeat_response(self, client_id: str, heartbeat_id: str = None):
        """Handle heartbeat response from client"""
        async with self._lock:
            if client_id in self.connection_metadata:
                metadata = self.connection_metadata[client_id]
                metadata["missed_heartbeats"] = 0  # Reset missed heartbeats
                metadata["heartbeat_response_count"] += 1
                metadata["last_activity"] = datetime.now()
                logger.debug(f"Client {client_id} responded to heartbeat {heartbeat_id}")

    def stop_cleanup_task(self):
        """Stop the cleanup task"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            self._cleanup_task = None

    def shutdown(self):
        """Shutdown all background tasks"""
        self.stop_heartbeat()
        self.stop_cleanup_task()


manager = ConnectionManager()
