import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, and_, func, select

from app.core import get_session
from app.models import Board, Ticket, TicketHistory

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/tickets/{ticket_id}/history", response_model=List[Dict[str, Any]])
async def get_ticket_history(
    ticket_id: int,
    session: Session = Depends(get_session),
    limit: int = Query(50, le=100, description="Maximum number of history entries"),
    field_name: Optional[str] = Query(None, description="Filter by specific field"),
):
    """Get complete history for a specific ticket"""

    try:
        # Verify ticket exists
        ticket = session.get(Ticket, ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        query = select(TicketHistory).where(TicketHistory.ticket_id == ticket_id)

        if field_name:
            query = query.where(TicketHistory.field_name == field_name)

        query = query.order_by(TicketHistory.changed_at.desc()).limit(limit)

        history = session.exec(query).all()

        return [
            {
                "id": h.id,
                "field_name": h.field_name,
                "old_value": h.old_value,
                "new_value": h.new_value,
                "changed_by": h.changed_by,
                "changed_at": h.changed_at.isoformat(),
                "ticket_id": h.ticket_id,
            }
            for h in history
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving ticket history for {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ticket history")


@router.get("/tickets/{ticket_id}/transitions")
async def get_ticket_transitions(ticket_id: int, session: Session = Depends(get_session)):
    """Get column transition history with durations"""

    # Verify ticket exists
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    try:
        # Get column transitions
        query = (
            select(TicketHistory)
            .where(and_(TicketHistory.ticket_id == ticket_id, TicketHistory.field_name == "column"))
            .order_by(TicketHistory.changed_at.asc())
        )

        transitions = session.exec(query).all()

        # Calculate durations between transitions
        transition_data = []

        for i, transition in enumerate(transitions):
            duration_seconds = None

            # Calculate duration from previous transition or creation
            if i == 0:
                # Duration from ticket creation to first transition
                time_diff = transition.changed_at - ticket.created_at
                duration_seconds = time_diff.total_seconds()
            else:
                # Duration from previous transition
                time_diff = transition.changed_at - transitions[i - 1].changed_at
                duration_seconds = time_diff.total_seconds()

            transition_data.append(
                {
                    "from_column": transition.old_value,
                    "to_column": transition.new_value,
                    "changed_at": transition.changed_at.isoformat(),
                    "changed_by": transition.changed_by,
                    "duration_seconds": duration_seconds,
                    "duration_human": (
                        _format_duration(duration_seconds) if duration_seconds else None
                    ),
                }
            )

        # Add current column duration
        if transitions:
            last_transition = transitions[-1]
            current_duration = (datetime.utcnow() - last_transition.changed_at).total_seconds()
        else:
            current_duration = (datetime.utcnow() - ticket.created_at).total_seconds()

        return {
            "ticket_id": ticket_id,
            "current_column": ticket.current_column,
            "current_duration_seconds": current_duration,
            "current_duration_human": _format_duration(current_duration),
            "transitions": transition_data,
            "total_transitions": len(transition_data),
        }

    except Exception as e:
        logger.error(f"Error retrieving transitions for ticket {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ticket transitions")


@router.get("/boards/{board_id}/activity")
async def get_board_activity(
    board_id: int,
    session: Session = Depends(get_session),
    hours: int = Query(24, le=168, description="Hours to look back"),
    limit: int = Query(100, le=500, description="Maximum number of activities"),
):
    """Get recent activity across all tickets in a board"""

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    try:
        # Get tickets in this board
        ticket_ids_query = select(Ticket.id).where(Ticket.board_id == board_id)
        ticket_ids = session.exec(ticket_ids_query).all()

        if not ticket_ids:
            return {"board_id": board_id, "activities": [], "timeframe_hours": hours}

        # Get recent history for these tickets
        since_time = datetime.utcnow() - timedelta(hours=hours)

        query = (
            select(TicketHistory, Ticket.title)
            .join(Ticket, TicketHistory.ticket_id == Ticket.id)
            .where(
                and_(
                    TicketHistory.ticket_id.in_(ticket_ids), TicketHistory.changed_at >= since_time
                )
            )
            .order_by(TicketHistory.changed_at.desc())
            .limit(limit)
        )

        results = session.exec(query).all()

        activities = []
        for history, ticket_title in results:
            activities.append(
                {
                    "id": history.id,
                    "ticket_id": history.ticket_id,
                    "ticket_title": ticket_title,
                    "field_name": history.field_name,
                    "old_value": history.old_value,
                    "new_value": history.new_value,
                    "changed_by": history.changed_by,
                    "changed_at": history.changed_at.isoformat(),
                    "time_ago": _time_ago(history.changed_at),
                }
            )

        return {
            "board_id": board_id,
            "activities": activities,
            "timeframe_hours": hours,
            "total_activities": len(activities),
        }

    except Exception as e:
        logger.error(f"Error retrieving board activity for {board_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve board activity")


@router.get("/stats")
async def get_history_statistics(
    session: Session = Depends(get_session),
    days: int = Query(7, le=30, description="Days to analyze"),
):
    """Get historical statistics about ticket movements and changes"""

    try:
        since_date = datetime.utcnow() - timedelta(days=days)

        # Total changes in period
        total_changes_query = (
            select(func.count())
            .select_from(TicketHistory)
            .where(TicketHistory.changed_at >= since_date)
        )
        total_changes = session.exec(total_changes_query).one()

        # Changes by field type
        field_stats_query = (
            select(TicketHistory.field_name, func.count().label("count"))
            .where(TicketHistory.changed_at >= since_date)
            .group_by(TicketHistory.field_name)
        )

        field_stats = session.exec(field_stats_query).all()

        # Changes by user/agent
        user_stats_query = (
            select(TicketHistory.changed_by, func.count().label("count"))
            .where(TicketHistory.changed_at >= since_date)
            .group_by(TicketHistory.changed_by)
        )

        user_stats = session.exec(user_stats_query).all()

        # Daily activity counts
        daily_stats_query = (
            select(func.date(TicketHistory.changed_at).label("date"), func.count().label("count"))
            .where(TicketHistory.changed_at >= since_date)
            .group_by(func.date(TicketHistory.changed_at))
        )

        daily_stats = session.exec(daily_stats_query).all()

        return {
            "analysis_period_days": days,
            "total_changes": total_changes,
            "changes_by_field": [{"field": field, "count": count} for field, count in field_stats],
            "changes_by_user": [
                {"user": user or "unknown", "count": count} for user, count in user_stats
            ],
            "daily_activity": [{"date": str(date), "count": count} for date, count in daily_stats],
        }

    except Exception as e:
        logger.error(f"Error generating history statistics: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate statistics")


def _format_duration(seconds: float) -> str:
    """Format duration in seconds to human-readable string"""
    if seconds < 60:
        return f"{int(seconds)}s"
    elif seconds < 3600:
        return f"{int(seconds / 60)}m"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        minutes = int((seconds % 3600) / 60)
        return f"{hours}h {minutes}m"
    else:
        days = int(seconds / 86400)
        hours = int((seconds % 86400) / 3600)
        return f"{days}d {hours}h"


def _time_ago(timestamp: datetime) -> str:
    """Calculate human-readable time ago string"""
    now = datetime.utcnow()
    diff = now - timestamp

    if diff.total_seconds() < 60:
        return "just now"
    elif diff.total_seconds() < 3600:
        minutes = int(diff.total_seconds() / 60)
        return f"{minutes} minute{'s' if minutes != 1 else ''} ago"
    elif diff.total_seconds() < 86400:
        hours = int(diff.total_seconds() / 3600)
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    else:
        days = int(diff.total_seconds() / 86400)
        return f"{days} day{'s' if days != 1 else ''} ago"
