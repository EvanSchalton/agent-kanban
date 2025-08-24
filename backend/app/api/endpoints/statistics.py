import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core import get_session
from app.core.logging import metrics_collector
from app.models import Board, Ticket
from app.services.cache_service import cache_service
from app.services.statistics_service import statistics_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/boards/{board_id}/statistics")
async def get_board_statistics(
    board_id: int,
    session: Session = Depends(get_session),
    use_cache: bool = Query(True, description="Use cached statistics if available"),
):
    """Get comprehensive statistics for all columns in a board with caching"""

    # Check cache first if enabled
    if use_cache:
        cached_stats = cache_service.get_board_statistics(board_id)
        if cached_stats:
            logger.debug(f"Returning cached statistics for board {board_id}")
            return cached_stats

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    try:
        column_stats = statistics_service.calculate_board_statistics(session, board_id)

        # Convert to serializable format
        stats_dict = {}
        for column_name, stats in column_stats.items():
            stats_dict[column_name] = {
                "column_name": stats.column_name,
                "ticket_count": stats.ticket_count,
                "mean_time_seconds": stats.mean_time_seconds,
                "mean_time_hours": stats.mean_time_seconds / 3600,
                "std_deviation_seconds": stats.std_deviation_seconds,
                "std_deviation_hours": stats.std_deviation_seconds / 3600,
                "median_time_seconds": stats.median_time_seconds,
                "median_time_hours": stats.median_time_seconds / 3600,
                "min_time_seconds": stats.min_time_seconds,
                "max_time_seconds": stats.max_time_seconds,
                "percentile_95_seconds": stats.percentile_95_seconds,
                "percentile_95_hours": stats.percentile_95_seconds / 3600,
            }

        result = {
            "board_id": board_id,
            "board_name": board.name,
            "column_statistics": stats_dict,
            "cache_info": {
                "cached": False,
                "cache_ttl_seconds": cache_service.statistics_cache_ttl,
            },
        }

        # Cache the result if caching is enabled
        if use_cache:
            cache_service.cache_board_statistics(board_id, result)
            logger.debug(f"Cached statistics for board {board_id}")

        return result

    except Exception as e:
        logger.error(f"Error retrieving board statistics for {board_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve board statistics")


@router.get("/tickets/{ticket_id}/statistics")
async def get_ticket_statistics(ticket_id: int, session: Session = Depends(get_session)):
    """Get detailed statistics for a specific ticket"""

    # Verify ticket exists
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    try:
        # Get board statistics for context
        board_stats = statistics_service.calculate_board_statistics(session, ticket.board_id)

        # Get ticket-specific statistics
        ticket_stats = statistics_service.calculate_ticket_statistics(
            session, ticket_id, board_stats
        )

        if not ticket_stats:
            raise HTTPException(status_code=500, detail="Failed to calculate ticket statistics")

        # Get color classification
        column_stats = board_stats.get(ticket_stats.current_column)
        color_class = "normal"
        if column_stats:
            color_class = statistics_service.get_ticket_color_class(ticket_stats, column_stats)

        return {
            "ticket_id": ticket_stats.ticket_id,
            "current_column": ticket_stats.current_column,
            "time_in_current_column_seconds": ticket_stats.time_in_current_column_seconds,
            "time_in_current_column_hours": ticket_stats.time_in_current_column_seconds / 3600,
            "time_in_current_column_days": ticket_stats.time_in_current_column_seconds / 86400,
            "total_age_seconds": ticket_stats.total_age_seconds,
            "total_age_hours": ticket_stats.total_age_seconds / 3600,
            "total_age_days": ticket_stats.total_age_seconds / 86400,
            "column_transitions": ticket_stats.column_transitions,
            "z_score": ticket_stats.z_score,
            "percentile_rank": ticket_stats.percentile_rank,
            "color_classification": color_class.replace("ticket-", ""),
            "is_outlier": ticket_stats.z_score is not None and abs(ticket_stats.z_score) > 2.0,
        }

    except Exception as e:
        logger.error(f"Error retrieving ticket statistics for {ticket_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ticket statistics")


@router.get("/boards/{board_id}/performance")
async def get_board_performance(
    board_id: int,
    session: Session = Depends(get_session),
    days: int = Query(30, le=365, description="Number of days to analyze"),
):
    """Get board performance metrics over a specified time period"""

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    try:
        performance_metrics = statistics_service.get_performance_metrics(session, board_id, days)

        return {"board_id": board_id, "board_name": board.name, **performance_metrics}

    except Exception as e:
        logger.error(f"Error retrieving performance metrics for board {board_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve performance metrics")


@router.get("/boards/{board_id}/tickets/colors")
async def get_ticket_color_classifications(
    board_id: int,
    session: Session = Depends(get_session),
    column: Optional[str] = Query(None, description="Filter by specific column"),
    use_cache: bool = Query(True, description="Use cached color data if available"),
):
    """Get color classifications for all tickets in a board with caching"""

    # Check cache first if enabled
    if use_cache:
        cached_colors = cache_service.get_ticket_colors(board_id, column)
        if cached_colors:
            logger.debug(f"Returning cached ticket colors for board {board_id}, column {column}")
            return cached_colors

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    try:
        # Get board statistics
        board_stats = statistics_service.calculate_board_statistics(session, board_id)

        # Get tickets to analyze
        from sqlmodel import select

        query = select(Ticket).where(Ticket.board_id == board_id)

        if column:
            query = query.where(Ticket.current_column == column)

        tickets = session.exec(query).all()

        # Calculate color classifications
        ticket_colors = []

        for ticket in tickets:
            ticket_stats = statistics_service.calculate_ticket_statistics(
                session, ticket.id, board_stats
            )

            if ticket_stats:
                column_stats = board_stats.get(ticket_stats.current_column)
                color_class = "normal"
                if column_stats:
                    color_class = statistics_service.get_ticket_color_class(
                        ticket_stats, column_stats
                    )

                ticket_colors.append(
                    {
                        "ticket_id": ticket.id,
                        "title": ticket.title,
                        "current_column": ticket.current_column,
                        "color_class": color_class.replace("ticket-", ""),
                        "z_score": ticket_stats.z_score,
                        "time_in_column_hours": ticket_stats.time_in_current_column_seconds / 3600,
                    }
                )

        # Group by color classification
        color_summary = {}
        for ticket_color in ticket_colors:
            color = ticket_color["color_class"]
            if color not in color_summary:
                color_summary[color] = 0
            color_summary[color] += 1

        result = {
            "board_id": board_id,
            "board_name": board.name,
            "filter_column": column,
            "total_tickets": len(ticket_colors),
            "color_summary": color_summary,
            "ticket_colors": ticket_colors,
            "cache_info": {
                "cached": False,
                "cache_ttl_seconds": cache_service.statistics_cache_ttl,
            },
        }

        # Cache the result if caching is enabled
        if use_cache:
            cache_service.cache_ticket_colors(board_id, result, column)
            logger.debug(f"Cached ticket colors for board {board_id}, column {column}")

        return result

    except Exception as e:
        logger.error(f"Error retrieving ticket colors for board {board_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve ticket color classifications"
        )


@router.post("/statistics/cache/clear")
async def clear_statistics_cache():
    """Clear the statistics service cache (useful after bulk operations)"""

    try:
        statistics_service.clear_cache()
        return {"message": "Statistics cache cleared successfully"}

    except Exception as e:
        logger.error(f"Error clearing statistics cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")


@router.get("/boards/{board_id}/tickets/colors/realtime")
async def get_realtime_ticket_colors(
    board_id: int,
    ticket_ids: List[str] = Query(..., description="List of ticket IDs to get colors for"),
    session: Session = Depends(get_session),
):
    """Get real-time color classifications for specific tickets (optimized for drag-and-drop)"""

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    if len(ticket_ids) > 50:  # Limit to prevent abuse
        raise HTTPException(status_code=400, detail="Too many ticket IDs (max 50)")

    try:
        # Get board statistics (use cache if available)
        board_stats = statistics_service.calculate_board_statistics(session, board_id)

        # Get specific tickets
        from sqlmodel import select

        query = select(Ticket).where(Ticket.board_id == board_id, Ticket.id.in_(ticket_ids))
        tickets = session.exec(query).all()

        # Calculate colors for requested tickets only
        ticket_colors = []

        for ticket in tickets:
            ticket_stats = statistics_service.calculate_ticket_statistics(
                session, ticket.id, board_stats
            )

            if ticket_stats:
                column_stats = board_stats.get(ticket_stats.current_column)
                color_class = "normal"
                if column_stats:
                    color_class = statistics_service.get_ticket_color_class(
                        ticket_stats, column_stats
                    )

                ticket_colors.append(
                    {
                        "ticket_id": ticket.id,
                        "color_class": color_class.replace("ticket-", ""),
                        "z_score": ticket_stats.z_score,
                        "time_in_column_seconds": ticket_stats.time_in_current_column_seconds,
                        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
                    }
                )

        return {
            "board_id": board_id,
            "ticket_colors": ticket_colors,
            "response_time_optimized": True,
        }

    except Exception as e:
        logger.error(f"Error retrieving realtime ticket colors for board {board_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ticket colors")


@router.get("/boards/{board_id}/column/{column_name}/statistics")
async def get_column_statistics(
    board_id: int,
    column_name: str,
    session: Session = Depends(get_session),
    use_cache: bool = Query(True, description="Use cached statistics if available"),
):
    """Get detailed statistics for a specific column (useful for drag-and-drop target analysis)"""

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    try:
        # Get board statistics
        board_stats = statistics_service.calculate_board_statistics(session, board_id)

        if column_name not in board_stats:
            raise HTTPException(status_code=404, detail="Column not found")

        column_stats = board_stats[column_name]

        # Get tickets in this column for additional analysis
        from sqlmodel import select

        query = select(Ticket).where(
            Ticket.board_id == board_id, Ticket.current_column == column_name
        )
        tickets = session.exec(query).all()

        # Calculate color distribution for this column
        color_distribution = {}
        for ticket in tickets:
            ticket_stats = statistics_service.calculate_ticket_statistics(
                session, ticket.id, board_stats
            )

            if ticket_stats:
                color_class = statistics_service.get_ticket_color_class(ticket_stats, column_stats)
                color_key = color_class.replace("ticket-", "")

                if color_key not in color_distribution:
                    color_distribution[color_key] = 0
                color_distribution[color_key] += 1

        return {
            "board_id": board_id,
            "column_name": column_stats.column_name,
            "ticket_count": column_stats.ticket_count,
            "statistics": {
                "mean_time_seconds": column_stats.mean_time_seconds,
                "mean_time_hours": column_stats.mean_time_seconds / 3600,
                "std_deviation_seconds": column_stats.std_deviation_seconds,
                "std_deviation_hours": column_stats.std_deviation_seconds / 3600,
                "median_time_seconds": column_stats.median_time_seconds,
                "percentile_95_seconds": column_stats.percentile_95_seconds,
                "min_time_seconds": column_stats.min_time_seconds,
                "max_time_seconds": column_stats.max_time_seconds,
            },
            "color_distribution": color_distribution,
            "thresholds": {
                "warning_threshold_seconds": column_stats.mean_time_seconds
                + column_stats.std_deviation_seconds,
                "danger_threshold_seconds": column_stats.mean_time_seconds
                + (2 * column_stats.std_deviation_seconds),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving column statistics for {board_id}/{column_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve column statistics")


@router.get("/boards/{board_id}/drag-drop/metrics")
async def get_drag_drop_metrics(board_id: int, session: Session = Depends(get_session)):
    """Get drag-and-drop performance metrics for a specific board"""

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    try:
        metrics = metrics_collector.get_board_metrics(board_id)

        if not metrics:
            return {
                "board_id": board_id,
                "board_name": board.name,
                "metrics": {
                    "total_operations": 0,
                    "message": "No drag-and-drop operations recorded yet",
                },
            }

        return {
            "board_id": board_id,
            "board_name": board.name,
            "metrics": metrics,
            "performance_analysis": {
                "success_rate": (
                    (metrics["successful_operations"] / metrics["total_operations"]) * 100
                    if metrics["total_operations"] > 0
                    else 0
                ),
                "average_duration_ms": metrics["average_duration_ms"],
                "operations_per_hour": (
                    metrics["total_operations"]
                    / ((datetime.utcnow() - metrics["last_updated"]).total_seconds() / 3600)
                    if "last_updated" in metrics
                    else 0
                ),
            },
        }

    except Exception as e:
        logger.error(f"Error retrieving drag-drop metrics for board {board_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve drag-drop metrics")


@router.get("/drag-drop/metrics/all")
async def get_all_drag_drop_metrics():
    """Get drag-and-drop performance metrics for all boards"""

    try:
        all_metrics = metrics_collector.get_all_metrics()

        summary = {
            "total_boards_with_activity": len(all_metrics),
            "aggregate_metrics": {
                "total_operations": sum(m["total_operations"] for m in all_metrics.values()),
                "total_successful_operations": sum(
                    m["successful_operations"] for m in all_metrics.values()
                ),
                "total_failed_operations": sum(
                    m["failed_operations"] for m in all_metrics.values()
                ),
                "average_duration_ms": (
                    sum(m["average_duration_ms"] for m in all_metrics.values()) / len(all_metrics)
                    if all_metrics
                    else 0
                ),
            },
            "board_metrics": all_metrics,
        }

        # Calculate overall success rate
        if summary["aggregate_metrics"]["total_operations"] > 0:
            summary["aggregate_metrics"]["success_rate"] = (
                summary["aggregate_metrics"]["total_successful_operations"]
                / summary["aggregate_metrics"]["total_operations"]
            ) * 100
        else:
            summary["aggregate_metrics"]["success_rate"] = 0

        return summary

    except Exception as e:
        logger.error(f"Error retrieving all drag-drop metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve drag-drop metrics")


@router.post("/drag-drop/metrics/clear")
async def clear_drag_drop_metrics():
    """Clear all drag-and-drop metrics (useful for testing/reset)"""

    try:
        metrics_collector.metrics.clear()
        # Also clear from cache
        # Note: This is a simplified implementation - in production you might want
        # more granular control
        return {"message": "All drag-and-drop metrics cleared successfully"}

    except Exception as e:
        logger.error(f"Error clearing drag-drop metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear drag-drop metrics")


@router.get("/statistics/health")
async def get_statistics_health():
    """Get health status of the statistics service"""

    try:
        cache_size = len(statistics_service.cache)
        cache_keys = list(statistics_service.cache.keys())

        # Get Redis cache health too
        redis_health = cache_service.get_health_status()

        # Get drag-drop metrics health
        drag_drop_metrics_count = len(metrics_collector.get_all_metrics())

        return {
            "status": "healthy",
            "statistics_service": {
                "cache_size": cache_size,
                "cache_keys": cache_keys,
                "cache_duration_seconds": statistics_service.cache_duration,
            },
            "redis_cache": redis_health,
            "drag_drop_metrics": {
                "boards_with_metrics": drag_drop_metrics_count,
                "status": "operational",
            },
        }

    except Exception as e:
        logger.error(f"Error checking statistics service health: {e}")
        return {"status": "unhealthy", "error": str(e)}
