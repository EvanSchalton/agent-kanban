"""Ticket API endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from ..database import get_session
from ..models import (
    BoardColumn,
    Comment,
    CommentCreate,
    CommentResponse,
    HistoryResponse,
    Ticket,
    TicketCreate,
    TicketHistory,
    TicketResponse,
    TicketUpdate,
)
from .websocket import manager

router = APIRouter()


async def record_history(
    session: Session,
    ticket_id: int,
    field_name: str,
    old_value: str | None,
    new_value: str | None,
    changed_by: str,
) -> None:
    """Record a change in ticket history."""
    history = TicketHistory(
        ticket_id=ticket_id,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        changed_by=changed_by,
    )
    session.add(history)


@router.get("/", response_model=list[TicketResponse])
async def get_tickets(
    board_id: int | None = Query(None),
    column_id: int | None = Query(None),
    assignee: str | None = Query(None),
    session: Session = Depends(get_session),
) -> list[Ticket]:
    """Get tickets with optional filters."""
    query = select(Ticket)

    if board_id is not None:
        query = query.where(Ticket.board_id == board_id)
    if column_id is not None:
        query = query.where(Ticket.column_id == column_id)
    if assignee is not None:
        query = query.where(Ticket.assignee == assignee)

    tickets = session.exec(query.order_by(Ticket.priority)).all()

    # Add time in column to response
    response_tickets = []
    for ticket in tickets:
        ticket_dict = TicketResponse.model_validate(ticket).model_dump()
        ticket_dict["time_in_column"] = ticket.get_time_in_column()
        response_tickets.append(ticket_dict)

    return response_tickets


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: int, session: Session = Depends(get_session)) -> dict:
    """Get a specific ticket by ID."""
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket with id {ticket_id} not found"
        )

    response = TicketResponse.model_validate(ticket).model_dump()
    response["time_in_column"] = ticket.get_time_in_column()
    return response


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket_data: TicketCreate,
    board_id: int = Query(...),
    changed_by: str = Query("system"),
    session: Session = Depends(get_session),
) -> dict:
    """Create a new ticket."""
    # If no column_id provided, use the first column (Not Started)
    if ticket_data.column_id is None:
        first_column = session.exec(
            select(BoardColumn)
            .where(BoardColumn.board_id == board_id)
            .order_by(BoardColumn.position)
        ).first()

        if not first_column:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Board {board_id} has no columns"
            )
        column_id = first_column.id
    else:
        column_id = ticket_data.column_id

    ticket = Ticket(
        board_id=board_id,
        column_id=column_id,
        title=ticket_data.title,
        description=ticket_data.description,
        acceptance_criteria=ticket_data.acceptance_criteria,
        priority=ticket_data.priority,
        assignee=ticket_data.assignee,
    )

    session.add(ticket)
    session.flush()

    # Record creation in history
    await record_history(session, ticket.id, "created", None, "ticket created", changed_by)

    session.commit()
    session.refresh(ticket)

    response = TicketResponse.model_validate(ticket).model_dump()
    response["time_in_column"] = 0

    # Broadcast update
    await manager.broadcast({"type": "ticket_created", "board_id": board_id, "data": response})

    return response


@router.put("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: int,
    ticket_update: TicketUpdate,
    changed_by: str = Query("system"),
    session: Session = Depends(get_session),
) -> dict:
    """Update a ticket."""
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket with id {ticket_id} not found"
        )

    # Track changes for history
    update_data = ticket_update.model_dump(exclude_unset=True)

    for field, new_value in update_data.items():
        if new_value is not None:
            old_value = getattr(ticket, field)
            if old_value != new_value:
                await record_history(session, ticket_id, field, old_value, new_value, changed_by)

                # Special handling for column changes
                if field == "column_id":
                    ticket.update_column(new_value)
                else:
                    setattr(ticket, field, new_value)

    ticket.updated_at = datetime.utcnow()
    session.add(ticket)
    session.commit()
    session.refresh(ticket)

    response = TicketResponse.model_validate(ticket).model_dump()
    response["time_in_column"] = ticket.get_time_in_column()

    # Broadcast update
    await manager.broadcast({"type": "ticket_updated", "ticket_id": ticket_id, "data": response})

    return response


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: int, session: Session = Depends(get_session)) -> None:
    """Delete a ticket."""
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket with id {ticket_id} not found"
        )

    board_id = ticket.board_id
    session.delete(ticket)
    session.commit()

    # Broadcast update
    await manager.broadcast(
        {"type": "ticket_deleted", "ticket_id": ticket_id, "board_id": board_id}
    )


# Comment endpoints
@router.get("/{ticket_id}/comments", response_model=list[CommentResponse])
async def get_comments(ticket_id: int, session: Session = Depends(get_session)) -> list[Comment]:
    """Get all comments for a ticket."""
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket with id {ticket_id} not found"
        )

    comments = session.exec(
        select(Comment).where(Comment.ticket_id == ticket_id).order_by(Comment.created_at.desc())
    ).all()

    return comments


@router.post(
    "/{ticket_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED
)
async def create_comment(
    ticket_id: int, comment_data: CommentCreate, session: Session = Depends(get_session)
) -> Comment:
    """Add a comment to a ticket."""
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket with id {ticket_id} not found"
        )

    comment = Comment(ticket_id=ticket_id, text=comment_data.text, author=comment_data.author)

    session.add(comment)
    session.commit()
    session.refresh(comment)

    # Broadcast update
    await manager.broadcast(
        {
            "type": "comment_added",
            "ticket_id": ticket_id,
            "data": CommentResponse.model_validate(comment).model_dump(),
        }
    )

    return comment


# History endpoint
@router.get("/{ticket_id}/history", response_model=list[HistoryResponse])
async def get_ticket_history(
    ticket_id: int, session: Session = Depends(get_session)
) -> list[TicketHistory]:
    """Get history of changes for a ticket."""
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Ticket with id {ticket_id} not found"
        )

    history = session.exec(
        select(TicketHistory)
        .where(TicketHistory.ticket_id == ticket_id)
        .order_by(TicketHistory.changed_at.desc())
    ).all()

    return history


# Bulk operations
@router.post("/move", response_model=list[TicketResponse])
async def move_tickets(
    ticket_ids: list[int],
    column_id: int,
    changed_by: str = Query("system"),
    session: Session = Depends(get_session),
) -> list[dict]:
    """Move multiple tickets to a new column."""
    moved_tickets = []

    for ticket_id in ticket_ids:
        ticket = session.get(Ticket, ticket_id)
        if ticket:
            old_column_id = ticket.column_id
            ticket.update_column(column_id)
            await record_history(
                session, ticket_id, "column_id", old_column_id, column_id, changed_by
            )

            response = TicketResponse.model_validate(ticket).model_dump()
            response["time_in_column"] = 0
            moved_tickets.append(response)

    session.commit()

    # Broadcast update
    await manager.broadcast(
        {
            "type": "tickets_moved",
            "ticket_ids": ticket_ids,
            "column_id": column_id,
            "data": moved_tickets,
        }
    )

    return moved_tickets
