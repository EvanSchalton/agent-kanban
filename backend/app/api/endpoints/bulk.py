import logging
import time
from datetime import datetime
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session

from app.api.schemas.bulk import (
    BulkAssignRequest,
    BulkMoveRequest,
    BulkMoveResponse,
    BulkMoveResult,
    BulkOperationResponse,
    BulkUpdatePriorityRequest,
)
from app.core import get_session, settings
from app.core.logging import drag_drop_logger, metrics_collector
from app.models import Ticket, TicketHistory
from app.services.cache_service import cache_service
from app.services.socketio_service import broadcast_bulk_update
from app.services.websocket_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)

# Create limiter here to avoid circular import
# Use high limit during testing
default_limit = ["10000/minute"] if settings.testing else ["60/minute"]
limiter = Limiter(key_func=get_remote_address, default_limits=default_limit)


def apply_rate_limit(limit="10/minute"):
    """Conditional rate limiting decorator factory"""

    def decorator(func):
        if settings.testing:
            return func  # Skip rate limiting in tests
        else:
            return limiter.limit(limit)(func)

    return decorator


@router.post("/tickets/move", response_model=BulkMoveResponse)
@apply_rate_limit()
async def bulk_move_tickets(
    request: Request,
    bulk_request: BulkMoveRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Move multiple tickets to a target column"""
    start_time = time.perf_counter()

    logger.info(
        f"Bulk move request: {len(bulk_request.ticket_ids)} tickets to {bulk_request.target_column}"
    )

    results = []
    successful_moves = 0
    failed_moves = 0
    board_ids_to_invalidate = set()

    # Process each ticket
    for ticket_id in bulk_request.ticket_ids:
        try:
            # Get ticket
            ticket = session.get(Ticket, ticket_id)
            if not ticket:
                results.append(
                    BulkMoveResult(ticket_id=ticket_id, success=False, error="Ticket not found")
                )
                failed_moves += 1
                continue

            # Check if move is necessary
            if ticket.current_column == bulk_request.target_column:
                results.append(
                    BulkMoveResult(
                        ticket_id=ticket_id,
                        success=True,
                        old_column=ticket.current_column,
                        new_column=ticket.current_column,
                    )
                )
                successful_moves += 1
                continue

            old_column = ticket.current_column
            board_ids_to_invalidate.add(ticket.board_id)

            # Update ticket
            ticket.current_column = bulk_request.target_column
            ticket.column_entered_at = datetime.utcnow()
            ticket.updated_at = datetime.utcnow()

            # Create history entry
            history_entry = TicketHistory(
                ticket_id=ticket_id,
                field_name="current_column",
                old_value=old_column,
                new_value=bulk_request.target_column,
                changed_by="system",  # Could be enhanced to track actual user
                changed_at=datetime.utcnow(),
            )

            session.add(ticket)
            session.add(history_entry)

            results.append(
                BulkMoveResult(
                    ticket_id=ticket_id,
                    success=True,
                    old_column=old_column,
                    new_column=bulk_request.target_column,
                )
            )
            successful_moves += 1

        except Exception as e:
            logger.error(f"Failed to move ticket {ticket_id}: {e}")
            results.append(BulkMoveResult(ticket_id=ticket_id, success=False, error=str(e)))
            failed_moves += 1

    try:
        session.commit()
        logger.info(f"Bulk move committed: {successful_moves} successful, {failed_moves} failed")
    except Exception as e:
        session.rollback()
        logger.error(f"Bulk move transaction failed: {e}")
        # Mark all successful results as failed
        for result in results:
            if result.success:
                result.success = False
                result.error = "Transaction failed"
                failed_moves += 1
                successful_moves -= 1

    # Invalidate cache for affected boards
    for board_id in board_ids_to_invalidate:
        cache_service.invalidate_board_cache(board_id)

    # Broadcast changes in background
    if successful_moves > 0:
        background_tasks.add_task(
            broadcast_bulk_move_changes,
            bulk_request.ticket_ids,
            bulk_request.target_column,
            board_ids_to_invalidate,
        )

    execution_time = (time.perf_counter() - start_time) * 1000  # Convert to ms

    # Log bulk operation metrics for each affected board
    for board_id in board_ids_to_invalidate:
        drag_drop_logger.log_bulk_operation(
            operation_type="bulk_move",
            ticket_count=len(bulk_request.ticket_ids),
            board_id=board_id,
            execution_time_ms=execution_time,
            success_count=successful_moves,
            failure_count=failed_moves,
        )

        # Record metrics
        metrics_collector.record_operation(
            board_id=board_id,
            operation="bulk_move",
            duration_ms=execution_time,
            success=successful_moves > failed_moves,
        )

    return BulkMoveResponse(
        total_requested=len(bulk_request.ticket_ids),
        successful_moves=successful_moves,
        failed_moves=failed_moves,
        results=results,
        execution_time_ms=execution_time,
    )


@router.post("/tickets/priority", response_model=BulkOperationResponse)
@apply_rate_limit()
async def bulk_update_priority(
    request: Request,
    bulk_request: BulkUpdatePriorityRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Update priorities for multiple tickets"""
    start_time = time.perf_counter()

    logger.info(f"Bulk priority update: {len(bulk_request.updates)} tickets")

    results = []
    successful_operations = 0
    failed_operations = 0
    board_ids_to_invalidate = set()

    for update in bulk_request.updates:
        ticket_id = update.get("ticket_id")
        new_priority = update.get("priority")

        if not ticket_id or not new_priority:
            results.append(
                {"ticket_id": ticket_id, "success": False, "error": "Missing ticket_id or priority"}
            )
            failed_operations += 1
            continue

        try:
            ticket = session.get(Ticket, ticket_id)
            if not ticket:
                results.append(
                    {"ticket_id": ticket_id, "success": False, "error": "Ticket not found"}
                )
                failed_operations += 1
                continue

            old_priority = ticket.priority
            board_ids_to_invalidate.add(ticket.board_id)

            ticket.priority = str(new_priority)
            ticket.updated_at = datetime.utcnow()

            # Create history entry
            history_entry = TicketHistory(
                ticket_id=ticket_id,
                field_name="priority",
                old_value=old_priority,
                new_value=str(new_priority),
                changed_by="system",
                changed_at=datetime.utcnow(),
            )

            session.add(ticket)
            session.add(history_entry)

            results.append(
                {
                    "ticket_id": ticket_id,
                    "success": True,
                    "old_priority": old_priority,
                    "new_priority": str(new_priority),
                }
            )
            successful_operations += 1

        except Exception as e:
            logger.error(f"Failed to update priority for ticket {ticket_id}: {e}")
            results.append({"ticket_id": ticket_id, "success": False, "error": str(e)})
            failed_operations += 1

    try:
        session.commit()
        logger.info(
            f"Bulk priority update committed: {successful_operations} successful, "
            f"{failed_operations} failed"
        )
    except Exception as e:
        session.rollback()
        logger.error(f"Bulk priority update transaction failed: {e}")
        # Mark all as failed
        for result in results:
            if result.get("success"):
                result["success"] = False
                result["error"] = "Transaction failed"
                failed_operations += 1
                successful_operations -= 1

    # Invalidate cache for affected boards
    for board_id in board_ids_to_invalidate:
        cache_service.invalidate_board_cache(board_id)

    execution_time = (time.perf_counter() - start_time) * 1000

    return BulkOperationResponse(
        total_requested=len(bulk_request.updates),
        successful_operations=successful_operations,
        failed_operations=failed_operations,
        results=results,
        execution_time_ms=execution_time,
        operation_type="priority_update",
    )


@router.post("/tickets/assign", response_model=BulkOperationResponse)
@apply_rate_limit()
async def bulk_assign_tickets(
    request: Request,
    bulk_request: BulkAssignRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Assign or unassign multiple tickets"""
    start_time = time.perf_counter()

    logger.info(
        f"Bulk assign: {len(bulk_request.ticket_ids)} tickets to "
        f"{bulk_request.assignee or 'unassigned'}"
    )

    results = []
    successful_operations = 0
    failed_operations = 0
    board_ids_to_invalidate = set()

    for ticket_id in bulk_request.ticket_ids:
        try:
            ticket = session.get(Ticket, ticket_id)
            if not ticket:
                results.append(
                    {"ticket_id": ticket_id, "success": False, "error": "Ticket not found"}
                )
                failed_operations += 1
                continue

            old_assignee = ticket.assignee
            board_ids_to_invalidate.add(ticket.board_id)

            ticket.assignee = bulk_request.assignee
            ticket.updated_at = datetime.utcnow()

            # Create history entry
            history_entry = TicketHistory(
                ticket_id=ticket_id,
                field_name="assignee",
                old_value=old_assignee,
                new_value=bulk_request.assignee,
                changed_by="system",
                changed_at=datetime.utcnow(),
            )

            session.add(ticket)
            session.add(history_entry)

            results.append(
                {
                    "ticket_id": ticket_id,
                    "success": True,
                    "old_assignee": old_assignee,
                    "new_assignee": bulk_request.assignee,
                }
            )
            successful_operations += 1

        except Exception as e:
            logger.error(f"Failed to assign ticket {ticket_id}: {e}")
            results.append({"ticket_id": ticket_id, "success": False, "error": str(e)})
            failed_operations += 1

    try:
        session.commit()
        logger.info(
            f"Bulk assign committed: {successful_operations} successful, {failed_operations} failed"
        )
    except Exception as e:
        session.rollback()
        logger.error(f"Bulk assign transaction failed: {e}")
        for result in results:
            if result.get("success"):
                result["success"] = False
                result["error"] = "Transaction failed"
                failed_operations += 1
                successful_operations -= 1

    # Invalidate cache for affected boards
    for board_id in board_ids_to_invalidate:
        cache_service.invalidate_board_cache(board_id)

    execution_time = (time.perf_counter() - start_time) * 1000

    return BulkOperationResponse(
        total_requested=len(bulk_request.ticket_ids),
        successful_operations=successful_operations,
        failed_operations=failed_operations,
        results=results,
        execution_time_ms=execution_time,
        operation_type="assignment",
    )


async def broadcast_bulk_move_changes(ticket_ids: List[str], target_column: str, board_ids: set):
    """Background task to broadcast bulk move changes using optimized broadcasting"""
    try:
        # Create update data for each board
        for board_id in board_ids:
            updates = [
                {
                    "type": "bulk_move",
                    "ticket_ids": ticket_ids,
                    "target_column": target_column,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ]

            # Use optimized bulk update broadcast
            await manager.broadcast_bulk_update(board_id, updates)

            # SocketIO broadcast for frontend compatibility
            await broadcast_bulk_update(board_id, updates)

        logger.info(f"Broadcasted optimized bulk move to {len(board_ids)} boards")
    except Exception as e:
        logger.error(f"Failed to broadcast bulk move changes: {e}")


@router.get("/operations/status")
async def get_bulk_operations_status():
    """Get status and metrics for bulk operations"""
    return {
        "status": "operational",
        "rate_limits": {
            "bulk_move": "10/minute",
            "bulk_priority": "10/minute",
            "bulk_assign": "10/minute",
        },
        "max_batch_size": 100,  # Could be configurable
        "supported_operations": ["bulk_move", "bulk_priority_update", "bulk_assign"],
        "cache_integration": cache_service.client is not None,
        "websocket_integration": True,
    }
