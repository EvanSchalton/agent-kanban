#!/usr/bin/env python3
"""
MCP Server for Agent Kanban Board
Uses stdio transport for JSON-RPC communication and acts as middleware to REST API
"""

import sys
from typing import Any, Dict, List, Optional

import httpx
from fastmcp import FastMCP

# Initialize MCP server with stdio transport
mcp = FastMCP("agent-kanban-mcp")

# REST API base URL
API_BASE = "http://localhost:18000"

# HTTP client configuration
TIMEOUT = httpx.Timeout(30.0)


@mcp.tool()
async def list_tasks(
    board_id: Optional[int] = None,
    column: Optional[str] = None,
    assignee: Optional[str] = None,
    page: Optional[int] = 1,
    page_size: Optional[int] = 50,
) -> Dict[str, Any]:
    """Query tasks with optional filters from the kanban board"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        params = {}
        if board_id is not None:
            params["board_id"] = board_id
        if column:
            params["column"] = column
        if assignee:
            params["assignee"] = assignee
        params["page"] = page
        params["page_size"] = page_size

        response = await client.get(f"{API_BASE}/api/tickets/", params=params)
        response.raise_for_status()
        data = response.json()

        # Transform paginated response to simpler format for MCP
        return {
            "tasks": data.get("items", []),
            "total": data.get("total", 0),
            "page": data.get("page", 1),
            "page_size": data.get("page_size", 50),
            "has_next": data.get("has_next", False),
        }


@mcp.tool()
async def get_task(ticket_id: int) -> Dict[str, Any]:
    """Retrieve full task details by ID"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Get ticket details
        ticket_response = await client.get(f"{API_BASE}/api/tickets/{ticket_id}")
        ticket_response.raise_for_status()
        ticket = ticket_response.json()

        # Get comments for the ticket
        comments_response = await client.get(f"{API_BASE}/api/comments/ticket/{ticket_id}")
        comments_response.raise_for_status()
        comments = comments_response.json()

        # Get history for the ticket
        history_response = await client.get(f"{API_BASE}/api/history/tickets/{ticket_id}/history")
        history_response.raise_for_status()
        history = history_response.json()

        # Combine all data
        return {
            "id": ticket["id"],
            "title": ticket["title"],
            "description": ticket.get("description"),
            "acceptance_criteria": ticket.get("acceptance_criteria"),
            "priority": ticket["priority"],
            "assignee": ticket.get("assignee"),
            "column": ticket["current_column"],
            "board_id": ticket["board_id"],
            "created_at": ticket["created_at"],
            "updated_at": ticket["updated_at"],
            "comments": comments,
            "history": history,
        }


@mcp.tool()
async def create_task(
    title: str,
    board_id: int,
    description: Optional[str] = None,
    acceptance_criteria: Optional[str] = None,
    priority: Optional[str] = "1.0",
    assignee: Optional[str] = None,
    created_by: Optional[str] = "mcp_agent",
) -> Dict[str, Any]:
    """Create a new task on the kanban board"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        payload = {
            "title": title,
            "board_id": board_id,
            "current_column": "Not Started",
            "priority": priority,
            "created_by": created_by,
        }

        if description:
            payload["description"] = description
        if acceptance_criteria:
            payload["acceptance_criteria"] = acceptance_criteria
        if assignee:
            payload["assignee"] = assignee

        response = await client.post(f"{API_BASE}/api/tickets/", json=payload)
        response.raise_for_status()
        return response.json()


@mcp.tool()
async def edit_task(
    ticket_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    acceptance_criteria: Optional[str] = None,
    priority: Optional[str] = None,
    changed_by: Optional[str] = "mcp_agent",
) -> Dict[str, Any]:
    """Update task properties"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        payload = {"changed_by": changed_by}

        if title is not None:
            payload["title"] = title
        if description is not None:
            payload["description"] = description
        if acceptance_criteria is not None:
            payload["acceptance_criteria"] = acceptance_criteria
        if priority is not None:
            payload["priority"] = priority

        response = await client.put(f"{API_BASE}/api/tickets/{ticket_id}", json=payload)
        response.raise_for_status()
        result = response.json()
        result["message"] = "Task updated successfully"
        return result


@mcp.tool()
async def claim_task(ticket_id: int, agent_id: str) -> Dict[str, Any]:
    """Assign a task to the requesting agent"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.post(
            f"{API_BASE}/api/tickets/{ticket_id}/claim", params={"agent_id": agent_id}
        )
        response.raise_for_status()
        result = response.json()
        return {
            "id": result["id"],
            "assignee": result.get("assignee", agent_id),
            "message": f"Task claimed by {agent_id}",
        }


@mcp.tool()
async def update_task_status(
    ticket_id: int, column: str, updated_by: Optional[str] = "mcp_agent"
) -> Dict[str, Any]:
    """Move a task to a different column on the board"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        payload = {"column": column, "moved_by": updated_by}

        response = await client.post(f"{API_BASE}/api/tickets/{ticket_id}/move", json=payload)
        response.raise_for_status()
        result = response.json()

        return {
            "id": result["id"],
            "from_column": result.get("current_column", "Unknown"),
            "to_column": column,
            "message": f"Task moved to {column}",
        }


@mcp.tool()
async def add_comment(
    ticket_id: int, text: str, author: Optional[str] = "mcp_agent"
) -> Dict[str, Any]:
    """Add a timestamped comment to a task"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        payload = {"ticket_id": ticket_id, "text": text, "author": author}

        response = await client.post(f"{API_BASE}/api/comments/", json=payload)
        response.raise_for_status()
        result = response.json()

        return {
            "id": result["id"],
            "ticket_id": ticket_id,
            "created_at": result["created_at"],
            "message": "Comment added successfully",
        }


@mcp.tool()
async def list_columns(board_id: int) -> List[str]:
    """Get the list of columns for a board"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(f"{API_BASE}/api/boards/{board_id}/columns")
        response.raise_for_status()
        return response.json()


@mcp.tool()
async def get_board_state(board_id: int) -> Dict[str, Any]:
    """Retrieve the complete state of a board including all tickets"""
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Get board details
        board_response = await client.get(f"{API_BASE}/api/boards/{board_id}")
        board_response.raise_for_status()
        board = board_response.json()

        # Get columns
        columns_response = await client.get(f"{API_BASE}/api/boards/{board_id}/columns")
        columns_response.raise_for_status()
        columns = columns_response.json()

        # Get all tickets for the board
        tickets_response = await client.get(
            f"{API_BASE}/api/tickets/", params={"board_id": board_id, "page_size": 1000}
        )
        tickets_response.raise_for_status()
        tickets_data = tickets_response.json()
        tickets = tickets_data.get("items", [])

        # Organize tickets by column
        tickets_by_column = {col: [] for col in columns}
        for ticket in tickets:
            col = ticket.get("current_column")
            if col in tickets_by_column:
                tickets_by_column[col].append(
                    {
                        "id": ticket["id"],
                        "title": ticket["title"],
                        "assignee": ticket.get("assignee"),
                        "priority": ticket["priority"],
                    }
                )

        # Sort tickets by priority in each column
        for col in tickets_by_column:
            tickets_by_column[col].sort(key=lambda x: float(x["priority"]))

        # Calculate statistics
        column_distribution = {col: len(tickets_by_column[col]) for col in columns}

        return {
            "board_id": board["id"],
            "board_name": board["name"],
            "columns": columns,
            "tickets_by_column": tickets_by_column,
            "column_distribution": column_distribution,
            "total_tickets": len(tickets),
            "updated_at": board.get("updated_at", ""),
        }


def main():
    """Main entry point for the MCP server"""
    print("Starting Agent Kanban MCP Server (stdio mode)...", file=sys.stderr)
    print("This server acts as middleware between MCP clients and the REST API.", file=sys.stderr)
    print("\nAvailable tools:", file=sys.stderr)
    print("  - list_tasks: Query tasks with optional filters", file=sys.stderr)
    print("  - get_task: Retrieve full task details by ID", file=sys.stderr)
    print("  - create_task: Create new tasks", file=sys.stderr)
    print("  - edit_task: Update task properties", file=sys.stderr)
    print("  - claim_task: Assign task to an agent", file=sys.stderr)
    print("  - update_task_status: Move task between columns", file=sys.stderr)
    print("  - add_comment: Add comments to tasks", file=sys.stderr)
    print("  - list_columns: Get board columns", file=sys.stderr)
    print("  - get_board_state: Get complete board overview", file=sys.stderr)
    print("\nServer is running on stdio transport...\n", file=sys.stderr)

    # Run the MCP server with stdio transport
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
