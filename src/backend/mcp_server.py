"""MCP Server implementation for Agent Kanban Board."""

import asyncio
import os
from datetime import datetime
from typing import Any

from dotenv import load_dotenv
from mcp.server import Server
from sqlmodel import Session, select

from .database import engine
from .models import (
    Board,
    BoardColumn,
    Comment,
    Ticket,
    TicketHistory,
)

# Load environment variables
load_dotenv()

# Initialize MCP server
server = Server(
    name=os.getenv("MCP_SERVER_NAME", "agent-kanban-mcp"),
    version=os.getenv("MCP_SERVER_VERSION", "1.0.0"),
)


def get_db_session() -> Session:
    """Get a database session for MCP operations."""
    return Session(engine)


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


# MCP Tool Implementations


@server.tool()
async def list_tasks(
    column: str | None = None, assignee: str | None = None, board_id: int | None = 1
) -> list[dict[str, Any]]:
    """
    Query tasks with optional filters.

    Args:
        column: Filter by column name (optional)
        assignee: Filter by assignee (optional)
        board_id: Board ID to query (default: 1)

    Returns:
        List of tasks matching the filters
    """
    with get_db_session() as session:
        query = select(Ticket).where(Ticket.board_id == board_id)

        if column:
            # Find column by name
            col = session.exec(
                select(BoardColumn)
                .where(BoardColumn.board_id == board_id)
                .where(BoardColumn.name == column)
            ).first()
            if col:
                query = query.where(Ticket.column_id == col.id)

        if assignee:
            query = query.where(Ticket.assignee == assignee)

        tickets = session.exec(query.order_by(Ticket.priority)).all()

        result = []
        for ticket in tickets:
            col = session.get(BoardColumn, ticket.column_id)
            result.append(
                {
                    "id": ticket.id,
                    "title": ticket.title,
                    "description": ticket.description,
                    "column": col.name if col else "Unknown",
                    "priority": ticket.priority,
                    "assignee": ticket.assignee,
                    "created_at": ticket.created_at.isoformat(),
                    "time_in_column": ticket.get_time_in_column(),
                }
            )

        return result


@server.tool()
async def get_task(task_id: int) -> dict[str, Any]:
    """
    Retrieve full task details by ID.

    Args:
        task_id: The ID of the task to retrieve

    Returns:
        Full task details including comments and history
    """
    with get_db_session() as session:
        ticket = session.get(Ticket, task_id)
        if not ticket:
            return {"error": f"Task {task_id} not found"}

        col = session.get(BoardColumn, ticket.column_id)

        # Get comments
        comments = session.exec(
            select(Comment).where(Comment.ticket_id == task_id).order_by(Comment.created_at.desc())
        ).all()

        # Get history
        history = session.exec(
            select(TicketHistory)
            .where(TicketHistory.ticket_id == task_id)
            .order_by(TicketHistory.changed_at.desc())
        ).all()

        return {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "acceptance_criteria": ticket.acceptance_criteria,
            "column": col.name if col else "Unknown",
            "priority": ticket.priority,
            "assignee": ticket.assignee,
            "created_at": ticket.created_at.isoformat(),
            "updated_at": ticket.updated_at.isoformat(),
            "time_in_column": ticket.get_time_in_column(),
            "comments": [
                {"text": c.text, "author": c.author, "created_at": c.created_at.isoformat()}
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


@server.tool()
async def create_task(
    title: str,
    description: str | None = None,
    acceptance_criteria: str | None = None,
    priority: str = "1.0",
    column: str = "Not Started",
    board_id: int = 1,
    created_by: str = "agent",
) -> dict[str, Any]:
    """
    Create a new task.

    Args:
        title: Task title (required)
        description: Task description (optional)
        acceptance_criteria: Acceptance criteria (optional)
        priority: Multi-decimal priority (default: "1.0")
        column: Column name to place task in (default: "Not Started")
        board_id: Board ID (default: 1)
        created_by: Who is creating the task

    Returns:
        Created task details
    """
    with get_db_session() as session:
        # Find column by name
        col = session.exec(
            select(BoardColumn)
            .where(BoardColumn.board_id == board_id)
            .where(BoardColumn.name == column)
        ).first()

        if not col:
            # Use first column as fallback
            col = session.exec(
                select(BoardColumn)
                .where(BoardColumn.board_id == board_id)
                .order_by(BoardColumn.position)
            ).first()

        if not col:
            return {"error": "No columns found in board"}

        ticket = Ticket(
            board_id=board_id,
            column_id=col.id,
            title=title,
            description=description,
            acceptance_criteria=acceptance_criteria,
            priority=priority,
            assignee=None,
        )

        session.add(ticket)
        session.flush()

        # Record creation
        await record_history(session, ticket.id, "created", None, "task created", created_by)

        session.commit()
        session.refresh(ticket)

        return {
            "id": ticket.id,
            "title": ticket.title,
            "column": col.name,
            "priority": ticket.priority,
            "created_at": ticket.created_at.isoformat(),
            "message": f"Task '{title}' created successfully",
        }


@server.tool()
async def edit_task(
    task_id: int,
    title: str | None = None,
    description: str | None = None,
    acceptance_criteria: str | None = None,
    priority: str | None = None,
    edited_by: str = "agent",
) -> dict[str, Any]:
    """
    Update task properties.

    Args:
        task_id: ID of task to edit
        title: New title (optional)
        description: New description (optional)
        acceptance_criteria: New acceptance criteria (optional)
        priority: New priority (optional)
        edited_by: Who is editing the task

    Returns:
        Updated task details
    """
    with get_db_session() as session:
        ticket = session.get(Ticket, task_id)
        if not ticket:
            return {"error": f"Task {task_id} not found"}

        changes = []

        if title is not None and title != ticket.title:
            await record_history(session, task_id, "title", ticket.title, title, edited_by)
            ticket.title = title
            changes.append("title")

        if description is not None and description != ticket.description:
            await record_history(
                session, task_id, "description", ticket.description, description, edited_by
            )
            ticket.description = description
            changes.append("description")

        if acceptance_criteria is not None and acceptance_criteria != ticket.acceptance_criteria:
            await record_history(
                session,
                task_id,
                "acceptance_criteria",
                ticket.acceptance_criteria,
                acceptance_criteria,
                edited_by,
            )
            ticket.acceptance_criteria = acceptance_criteria
            changes.append("acceptance_criteria")

        if priority is not None and priority != ticket.priority:
            await record_history(session, task_id, "priority", ticket.priority, priority, edited_by)
            ticket.priority = priority
            changes.append("priority")

        ticket.updated_at = datetime.utcnow()
        session.add(ticket)
        session.commit()
        session.refresh(ticket)

        return {
            "id": ticket.id,
            "title": ticket.title,
            "changes": changes,
            "message": f"Task {task_id} updated: {', '.join(changes)}"
            if changes
            else "No changes made",
        }


@server.tool()
async def claim_task(task_id: int, agent_id: str) -> dict[str, Any]:
    """
    Assign task to requesting agent.

    Args:
        task_id: ID of task to claim
        agent_id: ID of agent claiming the task

    Returns:
        Success message or error
    """
    with get_db_session() as session:
        ticket = session.get(Ticket, task_id)
        if not ticket:
            return {"error": f"Task {task_id} not found"}

        if ticket.assignee:
            return {"error": f"Task already assigned to {ticket.assignee}"}

        await record_history(session, task_id, "assignee", None, agent_id, agent_id)
        ticket.assignee = agent_id
        ticket.updated_at = datetime.utcnow()

        session.add(ticket)
        session.commit()

        return {
            "id": ticket.id,
            "title": ticket.title,
            "assignee": agent_id,
            "message": f"Task '{ticket.title}' claimed by {agent_id}",
        }


@server.tool()
async def update_task_status(
    task_id: int, column: str, updated_by: str = "agent"
) -> dict[str, Any]:
    """
    Move task to different column.

    Args:
        task_id: ID of task to move
        column: Name of target column
        updated_by: Who is updating the status

    Returns:
        Success message with new status
    """
    with get_db_session() as session:
        ticket = session.get(Ticket, task_id)
        if not ticket:
            return {"error": f"Task {task_id} not found"}

        # Find column by name
        new_col = session.exec(
            select(BoardColumn)
            .where(BoardColumn.board_id == ticket.board_id)
            .where(BoardColumn.name == column)
        ).first()

        if not new_col:
            return {"error": f"Column '{column}' not found"}

        old_col = session.get(BoardColumn, ticket.column_id)

        await record_history(
            session, task_id, "column", old_col.name if old_col else "Unknown", column, updated_by
        )
        ticket.update_column(new_col.id)

        session.add(ticket)
        session.commit()

        return {
            "id": ticket.id,
            "title": ticket.title,
            "old_column": old_col.name if old_col else "Unknown",
            "new_column": column,
            "message": f"Task moved to '{column}'",
        }


@server.tool()
async def add_comment(task_id: int, text: str, author: str = "agent") -> dict[str, Any]:
    """
    Add timestamped comment to task.

    Args:
        task_id: ID of task to comment on
        text: Comment text
        author: Comment author

    Returns:
        Comment details
    """
    with get_db_session() as session:
        ticket = session.get(Ticket, task_id)
        if not ticket:
            return {"error": f"Task {task_id} not found"}

        comment = Comment(ticket_id=task_id, text=text, author=author)

        session.add(comment)
        session.commit()
        session.refresh(comment)

        return {
            "task_id": task_id,
            "comment_id": comment.id,
            "text": text,
            "author": author,
            "created_at": comment.created_at.isoformat(),
            "message": "Comment added successfully",
        }


@server.tool()
async def list_columns(board_id: int = 1) -> list[dict[str, Any]]:
    """
    Get current board columns.

    Args:
        board_id: Board ID (default: 1)

    Returns:
        List of columns with their positions
    """
    with get_db_session() as session:
        columns = session.exec(
            select(BoardColumn)
            .where(BoardColumn.board_id == board_id)
            .order_by(BoardColumn.position)
        ).all()

        return [{"id": col.id, "name": col.name, "position": col.position} for col in columns]


@server.tool()
async def get_board_state(board_id: int = 1) -> dict[str, Any]:
    """
    Retrieve complete board state.

    Args:
        board_id: Board ID (default: 1)

    Returns:
        Complete board state with columns and tasks
    """
    with get_db_session() as session:
        board = session.get(Board, board_id)
        if not board:
            return {"error": f"Board {board_id} not found"}

        columns = session.exec(
            select(BoardColumn)
            .where(BoardColumn.board_id == board_id)
            .order_by(BoardColumn.position)
        ).all()

        board_state = {
            "id": board.id,
            "name": board.name,
            "description": board.description,
            "columns": [],
        }

        for col in columns:
            tickets = session.exec(
                select(Ticket).where(Ticket.column_id == col.id).order_by(Ticket.priority)
            ).all()

            board_state["columns"].append(
                {
                    "id": col.id,
                    "name": col.name,
                    "position": col.position,
                    "tasks": [
                        {
                            "id": t.id,
                            "title": t.title,
                            "priority": t.priority,
                            "assignee": t.assignee,
                            "time_in_column": t.get_time_in_column(),
                        }
                        for t in tickets
                    ],
                }
            )

        return board_state


async def run_mcp_server():
    """Run the MCP server."""
    from mcp.server.stdio import stdio_server

    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(run_mcp_server())
