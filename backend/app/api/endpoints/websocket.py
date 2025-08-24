import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: Optional[str] = Query(None),
    board_id: Optional[int] = Query(None),
    username: Optional[str] = Query(None, description="Username for attribution in events"),
):
    """Enhanced WebSocket endpoint with client ID, board subscription, and user
    attribution support"""
    client_id = await manager.connect(websocket, client_id, username=username)

    try:
        # Handle initial board subscription from query parameter
        if board_id is not None:
            await manager.subscribe_to_board(client_id, board_id)
        else:
            # For backward compatibility, subscribe to all boards
            await manager.subscribe_to_all_boards(client_id)

        # Send connection confirmation with username
        await websocket.send_text(
            json.dumps(
                {
                    "event": "connected",
                    "data": {
                        "client_id": client_id,
                        "username": username or "anonymous",
                        "message": "Connected to Agent Kanban Board WebSocket",
                        "board_id": board_id,
                        "server_time": manager.connection_metadata[client_id][
                            "connected_at"
                        ].isoformat(),
                    },
                }
            )
        )

        # Message processing loop
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle different message types
                if message.get("type") == "ping":
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "pong",
                                "timestamp": manager.connection_metadata[client_id][
                                    "last_activity"
                                ].isoformat(),
                            }
                        )
                    )
                elif message.get("type") == "heartbeat_response":
                    # Handle heartbeat response from client
                    heartbeat_id = message.get("heartbeat_id")
                    await manager.handle_heartbeat_response(client_id, heartbeat_id)
                    # Send acknowledgment
                    await websocket.send_text(
                        json.dumps(
                            {
                                "event": "heartbeat_ack",
                                "heartbeat_id": heartbeat_id,
                                "timestamp": datetime.now().isoformat(),
                            }
                        )
                    )
                elif message.get("type") == "subscribe_board":
                    # Handle board subscription
                    board_id = message.get("board_id")
                    if board_id is not None:
                        await manager.subscribe_to_board(client_id, board_id)
                        await websocket.send_text(
                            json.dumps({"event": "subscribed", "data": {"board_id": board_id}})
                        )
                    else:
                        await websocket.send_text(
                            json.dumps({"event": "error", "data": {"message": "board_id required"}})
                        )
                elif message.get("type") == "unsubscribe_board":
                    # Handle board unsubscription
                    board_id = message.get("board_id")
                    if board_id is not None:
                        await manager.unsubscribe_from_board(client_id, board_id)
                        await websocket.send_text(
                            json.dumps({"event": "unsubscribed", "data": {"board_id": board_id}})
                        )
                    else:
                        await websocket.send_text(
                            json.dumps({"event": "error", "data": {"message": "board_id required"}})
                        )
                elif message.get("type") == "get_stats":
                    # Send connection stats to client
                    stats = manager.get_connection_stats()
                    await websocket.send_text(json.dumps({"event": "stats", "data": stats}))
                else:
                    # Echo unknown message types for debugging
                    await websocket.send_text(json.dumps({"event": "echo", "data": message}))

            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON from client {client_id}: {e}")
                await websocket.send_text(
                    json.dumps({"event": "error", "data": {"message": "Invalid JSON format"}})
                )

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
    finally:
        await manager.disconnect(client_id)


@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics"""
    return manager.get_connection_stats()


@router.post("/cleanup")
async def cleanup_inactive_connections(timeout_seconds: int = 300):
    """Manually trigger cleanup of inactive connections"""
    await manager.cleanup_inactive_connections(timeout_seconds)
    return {"message": f"Cleaned up inactive connections (timeout: {timeout_seconds}s)"}


@router.post("/broadcast")
async def manual_broadcast(message: dict):
    """Manually broadcast a message to all connected clients (for testing)"""
    count = await manager.broadcast({"event": "manual_broadcast", "data": message})
    return {"message": f"Broadcasted to {count} clients"}
