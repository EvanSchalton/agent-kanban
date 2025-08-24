"""WebSocket connection management and real-time updates."""

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.connection_info: dict[WebSocket, dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, client_id: str = None):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_info[websocket] = {
            "client_id": client_id,
            "connected_at": datetime.utcnow().isoformat(),
        }
        print(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.connection_info:
            client_id = self.connection_info[websocket].get("client_id", "unknown")
            del self.connection_info[websocket]
            print(
                f"Client {client_id} disconnected. Total connections: "
                f"{len(self.active_connections)}"
            )

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket connection."""
        try:
            await websocket.send_text(message)
        except Exception as e:
            print(f"Error sending message to client: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict[str, Any]):
        """Broadcast a message to all connected clients."""

        # Convert datetime objects to ISO format strings
        def serialize(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {k: serialize(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [serialize(item) for item in obj]
            return obj

        serialized_message = serialize(message)
        message_str = json.dumps(serialized_message)
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                print(f"Error broadcasting to client: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

    async def broadcast_to_board(self, board_id: int, message: dict[str, Any]):
        """Broadcast a message to clients watching a specific board."""
        # For now, broadcast to all. In production, you'd track which boards each client is watching
        await self.broadcast(message)

    def get_connection_count(self) -> int:
        """Get the number of active connections."""
        return len(self.active_connections)

    def get_connection_info(self) -> list[dict[str, Any]]:
        """Get information about all active connections."""
        return [
            {"client_id": info.get("client_id"), "connected_at": info.get("connected_at")}
            for info in self.connection_info.values()
        ]


# Create a singleton instance
manager = ConnectionManager()


@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket, client_id: str = None):
    """WebSocket endpoint for real-time updates."""
    await manager.connect(websocket, client_id)

    try:
        # Send initial connection confirmation
        await manager.send_personal_message(
            json.dumps(
                {
                    "type": "connection_established",
                    "message": "Connected to Agent Kanban Board",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ),
            websocket,
        )

        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)

                # Handle different message types
                if message.get("type") == "ping":
                    # Respond to ping with pong
                    await manager.send_personal_message(
                        json.dumps({"type": "pong", "timestamp": datetime.utcnow().isoformat()}),
                        websocket,
                    )

                elif message.get("type") == "subscribe":
                    # Handle board subscription (for future enhancement)
                    board_id = message.get("board_id")
                    await manager.send_personal_message(
                        json.dumps(
                            {
                                "type": "subscribed",
                                "board_id": board_id,
                                "timestamp": datetime.utcnow().isoformat(),
                            }
                        ),
                        websocket,
                    )

                else:
                    # Echo unknown messages back (for debugging)
                    await manager.send_personal_message(
                        json.dumps(
                            {
                                "type": "echo",
                                "original_message": message,
                                "timestamp": datetime.utcnow().isoformat(),
                            }
                        ),
                        websocket,
                    )

            except json.JSONDecodeError:
                await manager.send_personal_message(
                    json.dumps(
                        {
                            "type": "error",
                            "message": "Invalid JSON format",
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    ),
                    websocket,
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.get("/status")
async def websocket_status():
    """Get WebSocket connection status."""
    return {
        "active_connections": manager.get_connection_count(),
        "connections": manager.get_connection_info(),
    }
