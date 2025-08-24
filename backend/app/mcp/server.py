from datetime import datetime
from typing import Any, Dict, List, Optional

from fastmcp import FastMCP
from sqlmodel import select

from app.core import get_session
from app.models import Board, Comment, Ticket, TicketHistory
from app.services.history_service import record_ticket_change

mcp = FastMCP("agent-kanban-mcp")


async def setup_mcp_server():
    pass


@mcp.tool()
async def list_tasks(
    board_id: Optional[int] = None,
    column: Optional[str] = None,
    assignee: Optional[str] = None,
    priority_threshold: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Query tasks with optional filters"""
    with next(get_session()) as session:
        query = select(Ticket)

        if board_id:
            query = query.where(Ticket.board_id == board_id)
        if column:
            query = query.where(Ticket.current_column == column)
        if assignee:
            query = query.where(Ticket.assignee == assignee)

        tickets = session.exec(query).all()

        if priority_threshold:
            tickets = [t for t in tickets if t.priority <= priority_threshold]

        tickets = sorted(tickets, key=lambda x: x.priority)

        return [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "priority": t.priority,
                "assignee": t.assignee,
                "column": t.current_column,
                "board_id": t.board_id,
                "time_in_column": t.get_time_in_column(),
            }
            for t in tickets
        ]


@mcp.tool()
async def get_task(ticket_id: int) -> Dict[str, Any]:
    """Retrieve full task details by ID"""
    with next(get_session()) as session:
        ticket = session.get(Ticket, ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")

        comments = session.exec(
            select(Comment).where(Comment.ticket_id == ticket_id).order_by(Comment.created_at)
        ).all()

        history = session.exec(
            select(TicketHistory)
            .where(TicketHistory.ticket_id == ticket_id)
            .order_by(TicketHistory.changed_at)
        ).all()

        return {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "acceptance_criteria": ticket.acceptance_criteria,
            "priority": ticket.priority,
            "assignee": ticket.assignee,
            "column": ticket.current_column,
            "board_id": ticket.board_id,
            "created_at": ticket.created_at.isoformat(),
            "updated_at": ticket.updated_at.isoformat(),
            "time_in_column": ticket.get_time_in_column(),
            "comments": [
                {
                    "id": c.id,
                    "text": c.text,
                    "author": c.author,
                    "created_at": c.created_at.isoformat(),
                }
                for c in comments
            ],
            "history": [
                {
                    "field": h.field_name,
                    "old_value": h.old_value,
                    "new_value": h.new_value,
                    "changed_by": h.changed_by,
                    "changed_at": h.changed_at.isoformat(),
                }
                for h in history
            ],
        }


@mcp.tool()
async def create_task(
    title: str,
    board_id: int,
    description: Optional[str] = None,
    acceptance_criteria: Optional[str] = None,
    priority: str = "1.0",
    assignee: Optional[str] = None,
    created_by: str = "mcp_agent",
) -> Dict[str, Any]:
    """Create new tasks with all required fields"""
    with next(get_session()) as session:
        board = session.get(Board, board_id)
        if not board:
            raise ValueError(f"Board {board_id} not found")

        ticket = Ticket(
            title=title,
            description=description,
            acceptance_criteria=acceptance_criteria,
            priority=priority,
            assignee=assignee,
            board_id=board_id,
            current_column="Not Started",
        )

        session.add(ticket)
        session.commit()
        session.refresh(ticket)

        record_ticket_change(
            session,
            ticket_id=ticket.id,
            field_name="status",
            old_value=None,
            new_value="created",
            changed_by=created_by,
        )

        # Enhanced WebSocket + SocketIO broadcasting
        from app.services.socketio_service import broadcast_ticket_created
        from app.services.websocket_manager import manager

        ticket_data = {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "priority": ticket.priority,
            "assignee": ticket.assignee,
            "current_column": ticket.current_column,
            "board_id": ticket.board_id,
            "created_at": ticket.created_at.isoformat(),
            "updated_at": ticket.updated_at.isoformat(),
            "created_by": created_by,
        }

        await manager.broadcast_to_board(
            ticket.board_id, {"event": "ticket_created", "data": ticket_data}
        )
        await broadcast_ticket_created(ticket.board_id, ticket_data)

        return {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "priority": ticket.priority,
            "board_id": ticket.board_id,
            "column": ticket.current_column,
        }


@mcp.tool()
async def edit_task(
    ticket_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    acceptance_criteria: Optional[str] = None,
    priority: Optional[str] = None,
    changed_by: str = "mcp_agent",
) -> Dict[str, Any]:
    """Update task properties"""
    with next(get_session()) as session:
        ticket = session.get(Ticket, ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")

        fields_to_update = {
            "title": title,
            "description": description,
            "acceptance_criteria": acceptance_criteria,
            "priority": priority,
        }

        for field, value in fields_to_update.items():
            if value is not None:
                old_value = getattr(ticket, field)
                if old_value != value:
                    record_ticket_change(
                        session,
                        ticket_id=ticket_id,
                        field_name=field,
                        old_value=str(old_value) if old_value else None,
                        new_value=str(value),
                        changed_by=changed_by,
                    )
                    setattr(ticket, field, value)

        session.add(ticket)
        session.commit()
        session.refresh(ticket)

        # Enhanced WebSocket + SocketIO broadcasting
        from app.services.socketio_service import broadcast_ticket_updated
        from app.services.websocket_manager import manager

        ticket_data = {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "priority": ticket.priority,
            "assignee": ticket.assignee,
            "current_column": ticket.current_column,
            "board_id": ticket.board_id,
            "updated_at": ticket.updated_at.isoformat(),
            "updated_by": changed_by,
        }

        await manager.broadcast_to_board(
            ticket.board_id, {"event": "ticket_updated", "data": ticket_data}
        )
        await broadcast_ticket_updated(ticket.board_id, ticket_data)

        return {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "priority": ticket.priority,
            "message": "Task updated successfully",
        }


@mcp.tool()
async def claim_task(ticket_id: int, agent_id: str) -> Dict[str, Any]:
    """Assign task to requesting agent"""
    with next(get_session()) as session:
        ticket = session.get(Ticket, ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")

        if ticket.assignee:
            raise ValueError(f"Ticket already assigned to {ticket.assignee}")

        record_ticket_change(
            session,
            ticket_id=ticket_id,
            field_name="assignee",
            old_value=None,
            new_value=agent_id,
            changed_by=agent_id,
        )

        ticket.assignee = agent_id
        session.add(ticket)
        session.commit()

        # Enhanced WebSocket + SocketIO broadcasting
        from app.services.socketio_service import broadcast_ticket_updated
        from app.services.websocket_manager import manager

        ticket_data = {
            "id": ticket.id,
            "title": ticket.title,
            "assignee": agent_id,
            "board_id": ticket.board_id,
            "current_column": ticket.current_column,
            "claimed_by": agent_id,
            "updated_at": datetime.utcnow().isoformat(),
        }

        await manager.broadcast_to_board(
            ticket.board_id, {"event": "ticket_claimed", "data": ticket_data}
        )
        await broadcast_ticket_updated(ticket.board_id, ticket_data)

        return {"id": ticket.id, "assignee": agent_id, "message": f"Task claimed by {agent_id}"}


@mcp.tool()
async def update_task_status(
    ticket_id: int, column: str, updated_by: str = "mcp_agent"
) -> Dict[str, Any]:
    """Move task to different column"""
    with next(get_session()) as session:
        ticket = session.get(Ticket, ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")

        board = session.get(Board, ticket.board_id)
        valid_columns = board.get_columns_list()

        if column not in valid_columns:
            raise ValueError(f"Invalid column. Valid columns: {valid_columns}")

        old_column = ticket.current_column

        record_ticket_change(
            session,
            ticket_id=ticket_id,
            field_name="column",
            old_value=old_column,
            new_value=column,
            changed_by=updated_by,
        )

        ticket.current_column = column
        ticket.column_entered_at = datetime.utcnow()

        session.add(ticket)
        session.commit()

        # Enhanced WebSocket + SocketIO broadcasting
        from app.services.socketio_service import broadcast_ticket_moved
        from app.services.websocket_manager import manager

        ticket_data = {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "priority": ticket.priority,
            "assignee": ticket.assignee,
            "current_column": column,
            "from_column": old_column,
            "to_column": column,
            "board_id": ticket.board_id,
            "moved_by": updated_by,
            "moved_at": ticket.column_entered_at.isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        await manager.broadcast_to_board(
            ticket.board_id, {"event": "ticket_moved", "data": ticket_data}
        )
        await broadcast_ticket_moved(ticket.board_id, ticket_data)

        return {
            "id": ticket.id,
            "from_column": old_column,
            "to_column": column,
            "message": f"Task moved to {column}",
        }


@mcp.tool()
async def add_comment(ticket_id: int, text: str, author: str = "MCP Agent") -> Dict[str, Any]:
    """Add timestamped comment to task"""
    with next(get_session()) as session:
        ticket = session.get(Ticket, ticket_id)
        if not ticket:
            raise ValueError(f"Ticket {ticket_id} not found")

        comment = Comment(ticket_id=ticket_id, text=text, author=author)

        session.add(comment)
        session.commit()
        session.refresh(comment)

        # Enhanced WebSocket + SocketIO broadcasting with board isolation
        from app.services.socketio_service import socketio_service
        from app.services.websocket_manager import manager

        comment_data = {
            "id": comment.id,
            "ticket_id": ticket_id,
            "board_id": ticket.board_id,
            "text": comment.text,
            "author": comment.author,
            "created_at": comment.created_at.isoformat(),
        }

        await manager.broadcast_to_board(
            ticket.board_id, {"event": "comment_added", "data": comment_data}
        )
        await socketio_service.emit_to_board(ticket.board_id, "comment_added", comment_data)

        return {
            "id": comment.id,
            "ticket_id": ticket_id,
            "created_at": comment.created_at.isoformat(),
            "message": "Comment added successfully",
        }


@mcp.tool()
async def list_columns(board_id: int) -> List[str]:
    """Get current board columns"""
    with next(get_session()) as session:
        board = session.get(Board, board_id)
        if not board:
            raise ValueError(f"Board {board_id} not found")

        return board.get_columns_list()


@mcp.tool()
async def get_board_state(board_id: int) -> Dict[str, Any]:
    """Retrieve complete board state"""
    with next(get_session()) as session:
        board = session.get(Board, board_id)
        if not board:
            raise ValueError(f"Board {board_id} not found")

        tickets = session.exec(select(Ticket).where(Ticket.board_id == board_id)).all()

        columns_dict = {}
        for column in board.get_columns_list():
            columns_dict[column] = []

        for ticket in tickets:
            if ticket.current_column in columns_dict:
                columns_dict[ticket.current_column].append(
                    {
                        "id": ticket.id,
                        "title": ticket.title,
                        "assignee": ticket.assignee,
                        "priority": ticket.priority,
                        "time_in_column": ticket.get_time_in_column(),
                    }
                )

        for column in columns_dict:
            columns_dict[column].sort(key=lambda x: x["priority"])

        column_distribution = {col: len(tickets) for col, tickets in columns_dict.items()}

        return {
            "board_id": board.id,
            "board_name": board.name,
            "columns": board.get_columns_list(),
            "tickets_by_column": columns_dict,
            "column_distribution": column_distribution,
            "total_tickets": len(tickets),
            "updated_at": board.updated_at.isoformat(),
        }
