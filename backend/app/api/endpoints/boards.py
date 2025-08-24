from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session, select

from app.api.schemas.board import BoardCreate, BoardResponse, BoardUpdate
from app.core import get_session, settings
from app.models import Board
from app.services.cache_service import cache_service
from app.services.socketio_service import (
    broadcast_board_updated,
    socketio_service,
)
from app.services.websocket_manager import manager

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.get("/", response_model=List[BoardResponse])
async def get_boards(session: Session = Depends(get_session)):
    from sqlmodel import func

    from app.models.ticket import Ticket

    boards = session.exec(select(Board)).all()

    # Build response with ticket counts
    board_responses = []
    for board in boards:
        ticket_count = (
            session.exec(select(func.count(Ticket.id)).where(Ticket.board_id == board.id)).first()
            or 0
        )

        board_response = BoardResponse(
            id=board.id,
            name=board.name,
            description=board.description,
            columns=board.get_columns_list(),
            created_at=board.created_at,
            updated_at=board.updated_at,
            ticket_count=ticket_count,
        )
        board_responses.append(board_response)

    return board_responses


@router.get("/default", response_model=BoardResponse)
async def get_default_board(session: Session = Depends(get_session)):
    """Get the default board (first board in database)"""
    from sqlmodel import func

    from app.models.ticket import Ticket

    boards = session.exec(select(Board)).all()
    if not boards:
        raise HTTPException(status_code=404, detail="No boards found")

    default_board = boards[0]
    # Add ticket count
    ticket_count = (
        session.exec(
            select(func.count(Ticket.id)).where(Ticket.board_id == default_board.id)
        ).first()
        or 0
    )

    return BoardResponse(
        id=default_board.id,
        name=default_board.name,
        description=default_board.description,
        columns=default_board.get_columns_list(),
        created_at=default_board.created_at,
        updated_at=default_board.updated_at,
        ticket_count=ticket_count,
    )


@router.get("/{board_id}", response_model=BoardResponse)
async def get_board(board_id: int, session: Session = Depends(get_session)):
    from sqlmodel import func

    from app.models.ticket import Ticket

    # Try cache first
    cached_board = cache_service.get_board_with_tickets(board_id)
    if cached_board and "board" in cached_board:
        return BoardResponse.parse_obj(cached_board["board"])

    # Fallback to database
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    # Add ticket count
    ticket_count = (
        session.exec(select(func.count(Ticket.id)).where(Ticket.board_id == board.id)).first() or 0
    )

    # Cache the result
    board_dict = {
        "id": board.id,
        "name": board.name,
        "description": board.description,
        "columns": board.get_columns_list(),
        "created_at": board.created_at.isoformat(),
        "updated_at": board.updated_at.isoformat(),
        "ticket_count": ticket_count,
    }
    cache_service.cache_board_with_tickets(board_id, {"board": board_dict})

    return BoardResponse(
        id=board.id,
        name=board.name,
        description=board.description,
        columns=board.get_columns_list(),
        created_at=board.created_at,
        updated_at=board.updated_at,
        ticket_count=ticket_count,
    )


@router.post("/", response_model=BoardResponse)
@limiter.limit("10000/minute" if settings.testing else "20/minute")
async def create_board(
    request: Request, board: BoardCreate, session: Session = Depends(get_session)
):
    board_data = board.model_dump()
    if "columns" in board_data and board_data["columns"]:
        columns = board_data.pop("columns")
        db_board = Board(**board_data)
        db_board.set_columns_list(columns)
    else:
        db_board = Board(**board_data)

    session.add(db_board)
    session.commit()
    session.refresh(db_board)

    # WebSocket broadcast to all clients (since it's a new board)
    await manager.broadcast(
        {
            "event": "board_created",
            "data": {
                "id": db_board.id,
                "name": db_board.name,
                "description": db_board.description,
                "columns": db_board.get_columns_list(),
                "created_at": db_board.created_at.isoformat(),
            },
        }
    )

    # SocketIO broadcast for frontend compatibility
    await socketio_service.emit_to_all(
        "board_created",
        {
            "id": db_board.id,
            "name": db_board.name,
            "description": db_board.description,
            "columns": db_board.get_columns_list(),
            "created_at": db_board.created_at.isoformat(),
        },
    )

    return BoardResponse.from_orm(db_board)


@router.put("/{board_id}", response_model=BoardResponse)
async def update_board(
    board_id: int, board_update: BoardUpdate, session: Session = Depends(get_session)
):
    db_board = session.get(Board, board_id)
    if not db_board:
        raise HTTPException(status_code=404, detail="Board not found")

    update_data = board_update.model_dump(exclude_unset=True)

    if "columns" in update_data:
        db_board.set_columns_list(update_data["columns"])
        del update_data["columns"]

    for field, value in update_data.items():
        setattr(db_board, field, value)

    db_board.updated_at = datetime.utcnow()
    session.add(db_board)
    session.commit()
    session.refresh(db_board)

    # WebSocket broadcast to board subscribers only
    await manager.broadcast_to_board(
        db_board.id,
        {
            "event": "board_updated",
            "data": {
                "id": db_board.id,
                "name": db_board.name,
                "description": db_board.description,
                "columns": db_board.get_columns_list(),
                "updated_at": db_board.updated_at.isoformat(),
            },
        },
    )

    # SocketIO broadcast for frontend compatibility
    await broadcast_board_updated(
        db_board.id,
        {
            "id": db_board.id,
            "name": db_board.name,
            "description": db_board.description,
            "columns": db_board.get_columns_list(),
            "updated_at": db_board.updated_at.isoformat(),
        },
    )

    return BoardResponse.from_orm(db_board)


@router.delete("/{board_id}")
async def delete_board(board_id: int, session: Session = Depends(get_session)):
    from app.models.comment import Comment
    from app.models.ticket import Ticket
    from app.models.ticket_history import TicketHistory

    db_board = session.get(Board, board_id)
    if not db_board:
        raise HTTPException(status_code=404, detail="Board not found")

    # Delete all related tickets and their dependencies first
    tickets = session.exec(select(Ticket).where(Ticket.board_id == board_id)).all()

    for ticket in tickets:
        # Delete related comments
        comments = session.exec(select(Comment).where(Comment.ticket_id == ticket.id)).all()
        for comment in comments:
            session.delete(comment)

        # Delete related history entries
        history_entries = session.exec(
            select(TicketHistory).where(TicketHistory.ticket_id == ticket.id)
        ).all()
        for history in history_entries:
            session.delete(history)

        # Delete the ticket
        session.delete(ticket)

    # Now delete the board
    session.delete(db_board)
    session.commit()

    # WebSocket broadcast to board subscribers only
    await manager.broadcast_to_board(board_id, {"event": "board_deleted", "data": {"id": board_id}})

    # SocketIO broadcast for frontend compatibility
    await socketio_service.emit_to_all("board_deleted", {"id": board_id})

    return {"message": "Board deleted successfully"}


@router.get("/{board_id}/columns", response_model=List[str])
async def get_board_columns(board_id: int, session: Session = Depends(get_session)):
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board.get_columns_list()


@router.put("/{board_id}/columns")
async def update_board_columns(
    board_id: int, columns: List[str], session: Session = Depends(get_session)
):
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    board.set_columns_list(columns)
    board.updated_at = datetime.utcnow()
    session.add(board)
    session.commit()

    # WebSocket broadcast to board subscribers only
    await manager.broadcast_to_board(
        board_id, {"event": "columns_updated", "data": {"board_id": board_id, "columns": columns}}
    )

    # SocketIO broadcast for frontend compatibility
    await socketio_service.emit_to_all(
        "columns_updated", {"board_id": board_id, "columns": columns}
    )

    return {"message": "Columns updated successfully", "columns": columns}


@router.get("/default/tickets")
async def get_default_board_tickets(session: Session = Depends(get_session)):
    """Get all tickets for the default board"""
    from app.models.ticket import Ticket

    boards = session.exec(select(Board)).all()
    if not boards:
        raise HTTPException(status_code=404, detail="No boards found")

    default_board = boards[0]

    query = (
        select(Ticket)
        .where(Ticket.board_id == default_board.id)
        .order_by(Ticket.current_column, Ticket.priority, Ticket.created_at)
    )
    tickets = session.exec(query).all()

    # Convert tickets to response format
    ticket_responses = []
    for ticket in tickets:
        ticket_dict = {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "priority": ticket.priority,
            "assignee": ticket.assignee,
            "current_column": ticket.current_column,
            "board_id": ticket.board_id,
            "created_at": ticket.created_at.isoformat(),
            "updated_at": ticket.updated_at.isoformat(),
            "column_entered_at": ticket.column_entered_at.isoformat(),
            "time_in_column": ticket.get_time_in_column(),
        }
        ticket_responses.append(ticket_dict)

    return {
        "board_id": default_board.id,
        "board_name": default_board.name,
        "tickets": ticket_responses,
        "total_tickets": len(ticket_responses),
    }


@router.get("/{board_id}/tickets")
async def get_board_tickets(board_id: int, session: Session = Depends(get_session)):
    """Get all tickets for a specific board"""
    from sqlmodel import select

    from app.models.ticket import Ticket

    # Verify board exists
    board = session.get(Board, board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    # Get tickets from database with proper filtering
    query = (
        select(Ticket)
        .where(Ticket.board_id == board_id)
        .order_by(Ticket.current_column, Ticket.priority, Ticket.created_at)
    )
    tickets = session.exec(query).all()

    # Convert tickets to response format (simplified to avoid errors)
    ticket_responses = []
    for ticket in tickets:
        try:
            ticket_dict = {
                "id": ticket.id,
                "title": ticket.title,
                "description": ticket.description,
                "priority": ticket.priority,
                "assignee": ticket.assignee,
                "current_column": ticket.current_column,
                "board_id": ticket.board_id,
                "created_at": ticket.created_at.isoformat(),
                "updated_at": ticket.updated_at.isoformat(),
                "column_entered_at": (
                    ticket.column_entered_at.isoformat() if ticket.column_entered_at else None
                ),
            }
            ticket_responses.append(ticket_dict)
        except Exception:
            # Skip problematic tickets but continue processing
            continue

    return {
        "board_id": board_id,
        "board_name": board.name,
        "tickets": ticket_responses,
        "total_tickets": len(ticket_responses),
    }
