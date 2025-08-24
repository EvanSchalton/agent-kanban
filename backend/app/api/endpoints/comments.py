from typing import List, Optional

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException
from sqlmodel import Session, select

from app.api.endpoints.users import get_username_from_session
from app.api.schemas.comment import CommentCreate, CommentResponse
from app.core import get_session
from app.models import Comment, Ticket
from app.services.socketio_service import socketio_service
from app.services.websocket_manager import manager

router = APIRouter()


@router.get("/ticket/{ticket_id}", response_model=List[CommentResponse])
async def get_ticket_comments(ticket_id: int, session: Session = Depends(get_session)):
    ticket = session.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    comments = session.exec(
        select(Comment).where(Comment.ticket_id == ticket_id).order_by(Comment.created_at)
    ).all()
    return comments


@router.post("/", response_model=CommentResponse)
async def create_comment(
    comment: CommentCreate,
    session: Session = Depends(get_session),
    session_id: Optional[str] = Cookie(None),
    x_session_id: Optional[str] = Header(None),
):
    ticket = session.get(Ticket, comment.ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Get username from session or use provided author
    username = get_username_from_session(session_id, x_session_id)

    # Create comment with actual username or fallback to provided author
    comment_data = comment.model_dump()
    if username:
        comment_data["author"] = username

    db_comment = Comment(**comment_data)
    session.add(db_comment)
    session.commit()
    session.refresh(db_comment)

    # WebSocket broadcast
    await manager.broadcast_to_board(
        ticket.board_id,
        {
            "event": "comment_added",
            "data": {
                "id": db_comment.id,
                "ticket_id": db_comment.ticket_id,
                "board_id": ticket.board_id,
                "text": db_comment.text,
                "author": db_comment.author,
                "created_at": db_comment.created_at.isoformat(),
            },
        },
    )

    # SocketIO broadcast for frontend compatibility
    await socketio_service.emit_to_board(
        ticket.board_id,
        "comment_added",
        {
            "id": db_comment.id,
            "ticket_id": db_comment.ticket_id,
            "board_id": ticket.board_id,
            "text": db_comment.text,
            "author": db_comment.author,
            "created_at": db_comment.created_at.isoformat(),
        },
    )

    return db_comment


@router.delete("/{comment_id}")
async def delete_comment(comment_id: int, session: Session = Depends(get_session)):
    db_comment = session.get(Comment, comment_id)
    if not db_comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    ticket_id = db_comment.ticket_id
    ticket = session.get(Ticket, ticket_id)

    session.delete(db_comment)
    session.commit()

    # WebSocket broadcast (only if ticket exists to get board_id)
    if ticket:
        await manager.broadcast_to_board(
            ticket.board_id,
            {
                "event": "comment_deleted",
                "data": {
                    "id": comment_id,
                    "ticket_id": ticket_id,
                    "board_id": ticket.board_id,
                },
            },
        )

    # SocketIO broadcast for frontend compatibility
    if ticket:
        await socketio_service.emit_to_board(
            ticket.board_id,
            "comment_deleted",
            {
                "id": comment_id,
                "ticket_id": ticket_id,
                "board_id": ticket.board_id,
            },
        )

    return {"message": "Comment deleted successfully"}
