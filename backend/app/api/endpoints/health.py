"""
Health Check Endpoint
Provides comprehensive system status information
"""

import os
from datetime import datetime, timezone
from typing import Any, Dict

import psutil
from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from app.api.endpoints.users import user_sessions
from app.core import get_session
from app.models import Board, Comment, Ticket, TicketHistory, User
from app.services.websocket_manager import manager

router = APIRouter()

# Track server start time
SERVER_START_TIME = datetime.now(timezone.utc)


def get_server_uptime() -> Dict[str, Any]:
    """Calculate server uptime"""
    now = datetime.now(timezone.utc)
    uptime = now - SERVER_START_TIME

    days = uptime.days
    hours = uptime.seconds // 3600
    minutes = (uptime.seconds % 3600) // 60
    seconds = uptime.seconds % 60

    return {
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "seconds": seconds,
        "total_seconds": int(uptime.total_seconds()),
        "human_readable": f"{days}d {hours}h {minutes}m {seconds}s",
    }


def get_system_resources() -> Dict[str, Any]:
    """Get system resource usage"""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.1)

        # Memory usage
        memory = psutil.virtual_memory()

        # Disk usage
        disk = psutil.disk_usage("/")

        # Process info
        process = psutil.Process()
        process_memory = process.memory_info()

        return {
            "cpu": {"usage_percent": cpu_percent, "count": psutil.cpu_count()},
            "memory": {
                "total_mb": memory.total // (1024 * 1024),
                "available_mb": memory.available // (1024 * 1024),
                "used_mb": memory.used // (1024 * 1024),
                "percent": memory.percent,
            },
            "disk": {
                "total_gb": disk.total // (1024 * 1024 * 1024),
                "used_gb": disk.used // (1024 * 1024 * 1024),
                "free_gb": disk.free // (1024 * 1024 * 1024),
                "percent": disk.percent,
            },
            "process": {
                "memory_mb": process_memory.rss // (1024 * 1024),
                "threads": process.num_threads(),
                "connections": len(process.connections(kind="inet")),
            },
        }
    except Exception as e:
        return {"error": f"Failed to get system resources: {str(e)}"}


@router.get("/")
async def health_check(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """
    Comprehensive health check endpoint

    Returns:
        System status including database, WebSocket, statistics, and uptime
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "server": {
            "name": "Agent Kanban API",
            "version": os.getenv("APP_VERSION", "1.0.0"),
            "environment": os.getenv("ENVIRONMENT", "development"),
            "uptime": get_server_uptime(),
        },
    }

    # Database health check
    try:
        # Test database connection with a simple query
        session.exec(select(func.count(Board.id))).first()

        # Get database statistics
        board_count = session.exec(select(func.count(Board.id))).first() or 0
        ticket_count = session.exec(select(func.count(Ticket.id))).first() or 0
        comment_count = session.exec(select(func.count(Comment.id))).first() or 0
        user_count = session.exec(select(func.count(User.id))).first() or 0
        history_count = session.exec(select(func.count(TicketHistory.id))).first() or 0

        # Get ticket distribution by status
        ticket_distribution = {}
        tickets = session.exec(
            select(Ticket.current_column, func.count(Ticket.id)).group_by(Ticket.current_column)
        ).all()
        for column, count in tickets:
            ticket_distribution[column] = count

        # Get ticket distribution by priority
        priority_distribution = {}
        priorities = session.exec(
            select(Ticket.priority, func.count(Ticket.id)).group_by(Ticket.priority)
        ).all()
        for priority, count in priorities:
            priority_distribution[priority] = count

        health_status["database"] = {
            "status": "connected",
            "statistics": {
                "boards": board_count,
                "tickets": ticket_count,
                "comments": comment_count,
                "users": user_count,
                "history_entries": history_count,
                "ticket_distribution": ticket_distribution,
                "priority_distribution": priority_distribution,
            },
        }
    except Exception as e:
        health_status["database"] = {"status": "error", "error": str(e)}
        health_status["status"] = "degraded"

    # WebSocket health check
    try:
        ws_stats = manager.get_connection_stats()

        # Get board subscription details
        board_subscriptions = {}
        for client_id, boards in manager.board_subscriptions.items():
            for board_id in boards:
                if board_id not in board_subscriptions:
                    board_subscriptions[board_id] = 0
                board_subscriptions[board_id] += 1

        health_status["websocket"] = {
            "status": "active",
            "active_connections": ws_stats["total_connections"],
            "total_messages_sent": ws_stats["total_messages_sent"],
            "board_subscriptions": board_subscriptions,
            "connections": [
                {
                    "client_id": conn["client_id"],
                    "duration_seconds": conn["connected_duration_seconds"],
                    "messages": conn["message_count"],
                }
                for conn in ws_stats.get("connections", [])[:10]  # Limit to 10 for readability
            ],
        }
    except Exception as e:
        health_status["websocket"] = {"status": "error", "error": str(e), "active_connections": 0}

    # User sessions health check
    try:
        active_sessions = len(user_sessions)
        session_usernames = [
            session.get("username", "unknown") for session in user_sessions.values()
        ][:10]  # Limit to 10

        health_status["sessions"] = {
            "active_count": active_sessions,
            "sample_users": session_usernames,
        }
    except Exception as e:
        health_status["sessions"] = {"status": "error", "error": str(e)}

    # System resources
    health_status["resources"] = get_system_resources()

    # Recent activity (last 5 ticket changes)
    try:
        recent_changes = session.exec(
            select(TicketHistory).order_by(TicketHistory.changed_at.desc()).limit(5)
        ).all()

        health_status["recent_activity"] = [
            {
                "ticket_id": change.ticket_id,
                "field": change.field_name,
                "old_value": change.old_value,
                "new_value": change.new_value,
                "changed_by": change.changed_by,
                "changed_at": change.changed_at.isoformat(),
            }
            for change in recent_changes
        ]
    except Exception:
        health_status["recent_activity"] = []

    # Performance metrics
    try:
        # Average tickets per board
        avg_tickets = 0
        if board_count > 0:
            avg_tickets = ticket_count / board_count

        # Comments per ticket
        avg_comments = 0
        if ticket_count > 0:
            avg_comments = comment_count / ticket_count

        health_status["metrics"] = {
            "average_tickets_per_board": round(avg_tickets, 2),
            "average_comments_per_ticket": round(avg_comments, 2),
            "total_database_records": (
                board_count + ticket_count + comment_count + user_count + history_count
            ),
        }
    except Exception:
        health_status["metrics"] = {}

    # Overall health determination
    if health_status.get("database", {}).get("status") == "error":
        health_status["status"] = "unhealthy"
    elif health_status.get("websocket", {}).get("status") == "error":
        health_status["status"] = "degraded"

    return health_status


@router.get("/simple")
async def simple_health_check() -> Dict[str, str]:
    """
    Simple health check for load balancers

    Returns:
        Basic health status
    """
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}
