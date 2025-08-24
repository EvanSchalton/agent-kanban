"""
Socket.IO service for frontend compatibility
Provides socket.io server that the frontend expects
"""

import logging
from datetime import datetime
from typing import Any, Dict

import socketio

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    cors_allowed_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:15175",
    ],
    logger=True,
    engineio_logger=True,
)


class SocketIOService:
    """Socket.IO service wrapper"""

    def __init__(self):
        self.connected_clients: Dict[str, Dict[str, Any]] = {}

    async def emit_to_board(self, board_id: int, event: str, data: Dict[str, Any]):
        """Emit event to all clients subscribed to a board"""
        try:
            await sio.emit(event, data, room=f"board_{board_id}")
            logger.info(f"Emitted {event} to board {board_id} clients")
        except Exception as e:
            logger.error(f"Failed to emit to board {board_id}: {e}")

    async def emit_to_all(self, event: str, data: Dict[str, Any]):
        """Emit event to all connected clients"""
        try:
            await sio.emit(event, data)
            logger.info(f"Emitted {event} to all clients")
        except Exception as e:
            logger.error(f"Failed to emit to all clients: {e}")


# Global service instance
socketio_service = SocketIOService()


@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    logger.info(f"Socket.IO client {sid} connected")

    # Store client info
    socketio_service.connected_clients[sid] = {"connected_at": datetime.utcnow(), "board_id": None}

    # Send connection confirmation
    await sio.emit(
        "connected",
        {
            "client_id": sid,
            "message": "Connected to Agent Kanban Board",
            "server_time": datetime.utcnow().isoformat(),
        },
        room=sid,
    )


@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    logger.info(f"Socket.IO client {sid} disconnected")

    # Clean up client data
    if sid in socketio_service.connected_clients:
        client_info = socketio_service.connected_clients.pop(sid)
        if client_info.get("board_id"):
            await sio.leave_room(sid, f"board_{client_info['board_id']}")


@sio.event
async def join_board(sid, data):
    """Handle client joining a board room"""
    board_id = data.get("board_id")

    if not board_id:
        await sio.emit("error", {"message": "board_id required"}, room=sid)
        return

    try:
        # Leave previous board room if any
        if sid in socketio_service.connected_clients:
            old_board_id = socketio_service.connected_clients[sid].get("board_id")
            if old_board_id and old_board_id != board_id:
                await sio.leave_room(sid, f"board_{old_board_id}")

        # Join new board room
        await sio.enter_room(sid, f"board_{board_id}")

        # Update client info
        socketio_service.connected_clients[sid]["board_id"] = board_id

        logger.info(f"Client {sid} joined board {board_id}")

        await sio.emit(
            "joined_board", {"board_id": board_id, "message": f"Joined board {board_id}"}, room=sid
        )

    except Exception as e:
        logger.error(f"Error joining board for client {sid}: {e}")
        await sio.emit("error", {"message": "Failed to join board"}, room=sid)


@sio.event
async def leave_board(sid, data):
    """Handle client leaving a board room"""
    board_id = data.get("board_id")

    if board_id:
        await sio.leave_room(sid, f"board_{board_id}")

        # Update client info
        if sid in socketio_service.connected_clients:
            socketio_service.connected_clients[sid]["board_id"] = None

        logger.info(f"Client {sid} left board {board_id}")

        await sio.emit(
            "left_board", {"board_id": board_id, "message": f"Left board {board_id}"}, room=sid
        )


@sio.event
async def ping(sid):
    """Handle ping/pong for keepalive"""
    await sio.emit("pong", {"timestamp": datetime.utcnow().isoformat()}, room=sid)


@sio.event
async def get_stats(sid):
    """Send connection statistics to client"""
    stats = {"connected_clients": len(socketio_service.connected_clients), "clients_by_board": {}}

    # Count clients per board
    for client_info in socketio_service.connected_clients.values():
        board_id = client_info.get("board_id")
        if board_id:
            if board_id not in stats["clients_by_board"]:
                stats["clients_by_board"][board_id] = 0
            stats["clients_by_board"][board_id] += 1

    await sio.emit("stats", stats, room=sid)


# Integration functions to bridge with existing WebSocket manager
async def broadcast_ticket_moved(board_id: int, ticket_data: Dict[str, Any]):
    """Broadcast ticket moved event via Socket.IO"""
    await socketio_service.emit_to_board(
        board_id,
        "ticket_moved",
        {"board_id": board_id, "ticket": ticket_data, "timestamp": datetime.utcnow().isoformat()},
    )


async def broadcast_ticket_created(board_id: int, ticket_data: Dict[str, Any]):
    """Broadcast ticket created event via Socket.IO"""
    await socketio_service.emit_to_board(
        board_id,
        "ticket_created",
        {"board_id": board_id, "ticket": ticket_data, "timestamp": datetime.utcnow().isoformat()},
    )


async def broadcast_ticket_updated(board_id: int, ticket_data: Dict[str, Any]):
    """Broadcast ticket updated event via Socket.IO"""
    await socketio_service.emit_to_board(
        board_id,
        "ticket_updated",
        {"board_id": board_id, "ticket": ticket_data, "timestamp": datetime.utcnow().isoformat()},
    )


async def broadcast_bulk_update(board_id: int, updates: list):
    """Broadcast bulk update event via Socket.IO"""
    await socketio_service.emit_to_board(
        board_id,
        "bulk_update",
        {"board_id": board_id, "updates": updates, "timestamp": datetime.utcnow().isoformat()},
    )


async def broadcast_board_updated(board_id: int, board_data: Dict[str, Any]):
    """Broadcast board updated event via Socket.IO"""
    await socketio_service.emit_to_board(
        board_id,
        "board_updated",
        {"board_id": board_id, "board": board_data, "timestamp": datetime.utcnow().isoformat()},
    )
