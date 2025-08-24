import time
from datetime import datetime, timezone
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session, func, select

from app.api.schemas.pagination import PaginatedResponse
from app.api.schemas.ticket import TicketCreate, TicketMove, TicketResponse, TicketUpdate
from app.core import get_session, settings
from app.core.logging import drag_drop_logger, log_drag_drop_operation, metrics_collector
from app.models import Board, Comment, Ticket, TicketHistory
from app.services.history_service import record_ticket_change
from app.services.socketio_service import (
    broadcast_ticket_created,
    broadcast_ticket_moved,
    broadcast_ticket_updated,
)
from app.services.websocket_manager import manager

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/", response_model=PaginatedResponse[TicketResponse])
@limiter.limit("10000/minute" if settings.testing else "100/minute")
async def get_tickets(
    request: Request,
    board_id: int = Query(..., description="Board ID is required"),
    column: Optional[str] = Query(None),
    assignee: Optional[str] = Query(None),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    session: Session = Depends(get_session),
):
    # Build base query
    query = select(Ticket)
    count_query = select(func.count()).select_from(Ticket)

    # Apply filters - board_id is now required
    query = query.where(Ticket.board_id == board_id)
    count_query = count_query.where(Ticket.board_id == board_id)
    if column:
        query = query.where(Ticket.current_column == column)
        count_query = count_query.where(Ticket.current_column == column)
    if assignee:
        query = query.where(Ticket.assignee == assignee)
        count_query = count_query.where(Ticket.assignee == assignee)

    # Get total count
    total = session.exec(count_query).one()

    # Calculate pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    # Execute query
    tickets = session.exec(query).all()

    # Calculate pagination metadata
    total_pages = ceil(total / page_size) if total > 0 else 1
    has_next = page < total_pages
    has_previous = page > 1

    return PaginatedResponse(
        items=tickets,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        has_next=has_next,
        has_previous=has_previous,
    )


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: int, session: Session = Depends(get_session)):
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.post("/", response_model=TicketResponse, status_code=201)
async def create_ticket(ticket: TicketCreate, session: Session = Depends(get_session)):
    board = session.get(Board, ticket.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    db_ticket = Ticket(**ticket.model_dump())
    session.add(db_ticket)
    session.commit()
    session.refresh(db_ticket)

    record_ticket_change(
        session,
        ticket_id=db_ticket.id,
        field_name="status",
        old_value=None,
        new_value="created",
        changed_by=ticket.created_by or "system",
    )

    # WebSocket broadcast with board isolation
    await manager.broadcast_to_board(
        db_ticket.board_id,
        {
            "event": "ticket_created",
            "data": {
                "id": db_ticket.id,
                "title": db_ticket.title,
                "description": db_ticket.description,
                "priority": db_ticket.priority,
                "assignee": db_ticket.assignee,
                "current_column": db_ticket.current_column,
                "board_id": db_ticket.board_id,
                "created_at": db_ticket.created_at.isoformat(),
                "updated_at": db_ticket.updated_at.isoformat(),
            },
        },
    )

    # SocketIO broadcast for frontend compatibility
    await broadcast_ticket_created(
        db_ticket.board_id,
        {
            "id": db_ticket.id,
            "title": db_ticket.title,
            "description": db_ticket.description,
            "priority": db_ticket.priority,
            "assignee": db_ticket.assignee,
            "current_column": db_ticket.current_column,
            "board_id": db_ticket.board_id,
            "created_at": db_ticket.created_at.isoformat(),
            "updated_at": db_ticket.updated_at.isoformat(),
        },
    )

    return db_ticket


@router.put("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: int, ticket_update: TicketUpdate, session: Session = Depends(get_session)
):
    db_ticket = session.get(Ticket, ticket_id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_data = ticket_update.model_dump(exclude_unset=True)
    changed_by = update_data.pop("changed_by", "system")

    for field, value in update_data.items():
        old_value = getattr(db_ticket, field)
        if old_value != value:
            record_ticket_change(
                session,
                ticket_id=ticket_id,
                field_name=field,
                old_value=str(old_value) if old_value else None,
                new_value=str(value) if value else None,
                changed_by=changed_by,
            )
            setattr(db_ticket, field, value)

    db_ticket.updated_at = datetime.now(timezone.utc)
    session.add(db_ticket)
    session.commit()
    session.refresh(db_ticket)

    # WebSocket broadcast with board isolation
    await manager.broadcast_to_board(
        db_ticket.board_id,
        {
            "event": "ticket_updated",
            "data": {
                "id": db_ticket.id,
                "title": db_ticket.title,
                "description": db_ticket.description,
                "priority": db_ticket.priority,
                "assignee": db_ticket.assignee,
                "current_column": db_ticket.current_column,
                "board_id": db_ticket.board_id,
                "updated_at": db_ticket.updated_at.isoformat(),
            },
        },
    )

    # SocketIO broadcast for frontend compatibility
    await broadcast_ticket_updated(
        db_ticket.board_id,
        {
            "id": db_ticket.id,
            "title": db_ticket.title,
            "description": db_ticket.description,
            "priority": db_ticket.priority,
            "assignee": db_ticket.assignee,
            "current_column": db_ticket.current_column,
            "board_id": db_ticket.board_id,
            "updated_at": db_ticket.updated_at.isoformat(),
        },
    )

    return db_ticket


@router.post("/{ticket_id}/move", response_model=TicketResponse)
@log_drag_drop_operation("ticket_move")
async def move_ticket(
    ticket_id: int, move_data: TicketMove, request: Request, session: Session = Depends(get_session)
):
    start_time = time.perf_counter()

    db_ticket = session.get(Ticket, ticket_id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_column = db_ticket.current_column

    # Log drag start
    drag_drop_logger.log_drop_attempt(
        ticket_id=str(ticket_id),
        board_id=db_ticket.board_id,
        source_column=old_column,
        target_column=move_data.column,
        client_timestamp=getattr(move_data, "client_timestamp", None),
    )

    try:
        record_ticket_change(
            session,
            ticket_id=ticket_id,
            field_name="column",
            old_value=old_column,
            new_value=move_data.column,
            changed_by=move_data.moved_by or "system",
        )

        db_ticket.current_column = move_data.column
        db_ticket.column_entered_at = datetime.now(timezone.utc)
        db_ticket.updated_at = datetime.now(timezone.utc)

        session.add(db_ticket)
        session.commit()
        session.refresh(db_ticket)

        # Use both WebSocket and Socket.IO broadcasting
        broadcast_start = time.perf_counter()

        ticket_data = {
            "id": db_ticket.id,
            "title": db_ticket.title,
            "description": db_ticket.description,
            "priority": db_ticket.priority,
            "assignee": db_ticket.assignee,
            "current_column": db_ticket.current_column,
            "from_column": old_column,
            "to_column": move_data.column,
            "moved_by": move_data.moved_by or "system",
            "moved_at": db_ticket.updated_at.isoformat(),
            "created_at": db_ticket.created_at.isoformat(),
            "updated_at": db_ticket.updated_at.isoformat(),
        }

        # WebSocket broadcast (existing)
        clients_reached = await manager.broadcast_drag_event(
            board_id=db_ticket.board_id, event_type="moved", ticket_data=ticket_data
        )

        # Socket.IO broadcast (new for frontend compatibility)
        await broadcast_ticket_moved(db_ticket.board_id, ticket_data)

        broadcast_time = (time.perf_counter() - broadcast_start) * 1000

        execution_time = (time.perf_counter() - start_time) * 1000

        # Log successful completion
        drag_drop_logger.log_drop_success(
            ticket_id=str(ticket_id),
            board_id=db_ticket.board_id,
            source_column=old_column,
            target_column=move_data.column,
            execution_time_ms=execution_time,
            websocket_broadcast_count=clients_reached,
        )

        # Log WebSocket performance
        drag_drop_logger.log_websocket_broadcast(
            board_id=db_ticket.board_id,
            event_type="ticket_moved",
            client_count=clients_reached,
            broadcast_time_ms=broadcast_time,
        )

        # Record metrics
        metrics_collector.record_operation(
            board_id=db_ticket.board_id,
            operation="move_ticket",
            duration_ms=execution_time,
            success=True,
        )

        return db_ticket

    except Exception as e:
        execution_time = (time.perf_counter() - start_time) * 1000

        # Log failure
        drag_drop_logger.log_drop_failure(
            ticket_id=str(ticket_id),
            board_id=db_ticket.board_id,
            source_column=old_column,
            target_column=move_data.column,
            error=str(e),
            execution_time_ms=execution_time,
        )

        # Record failed metrics
        metrics_collector.record_operation(
            board_id=db_ticket.board_id,
            operation="move_ticket",
            duration_ms=execution_time,
            success=False,
        )

        raise


@router.post("/{ticket_id}/claim", response_model=TicketResponse)
async def claim_ticket(ticket_id: int, agent_id: str, session: Session = Depends(get_session)):
    db_ticket = session.get(Ticket, ticket_id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if db_ticket.assignee:
        raise HTTPException(status_code=400, detail="Ticket already assigned")

    record_ticket_change(
        session,
        ticket_id=ticket_id,
        field_name="assignee",
        old_value=None,
        new_value=agent_id,
        changed_by=agent_id,
    )

    db_ticket.assignee = agent_id
    db_ticket.updated_at = datetime.now(timezone.utc)

    session.add(db_ticket)
    session.commit()
    session.refresh(db_ticket)

    await manager.broadcast_to_board(
        db_ticket.board_id,
        {
            "event": "ticket_claimed",
            "data": {"id": db_ticket.id, "board_id": db_ticket.board_id, "assignee": agent_id},
        },
    )

    return db_ticket


@router.delete("/{ticket_id}")
async def delete_ticket(ticket_id: int, session: Session = Depends(get_session)):
    db_ticket = session.get(Ticket, ticket_id)
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    board_id = db_ticket.board_id

    # Delete related comments first
    comments = session.exec(select(Comment).where(Comment.ticket_id == ticket_id)).all()
    for comment in comments:
        session.delete(comment)

    # Delete related history entries
    history_entries = session.exec(
        select(TicketHistory).where(TicketHistory.ticket_id == ticket_id)
    ).all()
    for history in history_entries:
        session.delete(history)

    # Now delete the ticket
    session.delete(db_ticket)
    session.commit()

    await manager.broadcast_to_board(
        board_id, {"event": "ticket_deleted", "data": {"id": ticket_id, "board_id": board_id}}
    )

    return {"message": "Ticket deleted successfully"}
