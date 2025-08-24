"""
MCP Server with API Integration
This version uses API endpoints instead of direct database access
"""

from typing import Any, Dict, List, Optional

import httpx
from fastmcp import FastMCP

# Configuration
API_BASE_URL = "http://localhost:18000/api"
MCP_AGENT_USERNAME = "MCP Agent"

mcp = FastMCP("agent-kanban-mcp-api")

# Global session for the MCP agent
mcp_session_id = None
http_client = httpx.AsyncClient(timeout=30.0)


async def setup_mcp_server():
    """Initialize MCP server and create agent session"""
    global mcp_session_id

    try:
        # Create or retrieve MCP agent session
        response = await http_client.post(
            f"{API_BASE_URL}/users/session", json={"username": MCP_AGENT_USERNAME}
        )

        if response.status_code == 200:
            data = response.json()
            mcp_session_id = data.get("session_id")
            print(f"MCP Agent session created: {mcp_session_id}")
        else:
            print(f"Failed to create MCP session: {response.status_code}")
    except Exception as e:
        print(f"Error setting up MCP server: {e}")


async def api_request(method: str, endpoint: str, json_data: Dict = None) -> Dict:
    """Make API request with MCP session"""
    headers = {}
    if mcp_session_id:
        headers["X-Session-Id"] = mcp_session_id

    url = f"{API_BASE_URL}{endpoint}"

    response = await http_client.request(method=method, url=url, json=json_data, headers=headers)

    if response.status_code >= 400:
        raise ValueError(f"API error {response.status_code}: {response.text}")

    return response.json()


@mcp.tool()
async def list_tasks(
    board_id: int,
    column: Optional[str] = None,
    assignee: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Dict[str, Any]:
    """
    Query tasks using the API with pagination support

    Args:
        board_id: Board ID (required)
        column: Filter by column name
        assignee: Filter by assignee
        page: Page number (default 1)
        page_size: Items per page (default 50, max 100)

    Returns:
        Paginated list of tasks with metadata
    """
    params = {"board_id": board_id, "page": page, "page_size": min(page_size, 100)}  # Cap at 100

    if column:
        params["column"] = column
    if assignee:
        params["assignee"] = assignee

    # Build query string
    query_parts = [f"{k}={v}" for k, v in params.items()]
    query_string = "&".join(query_parts)

    result = await api_request("GET", f"/tickets/?{query_string}")

    # Format the response
    return {
        "tickets": [
            {
                "id": t["id"],
                "title": t["title"],
                "description": t["description"],
                "priority": t["priority"],
                "assignee": t["assignee"],
                "column": t["current_column"],
                "board_id": t["board_id"],
            }
            for t in result.get("items", [])
        ],
        "pagination": {
            "total": result.get("total", 0),
            "page": result.get("page", 1),
            "page_size": result.get("page_size", 50),
            "total_pages": result.get("total_pages", 1),
            "has_next": result.get("has_next", False),
            "has_previous": result.get("has_previous", False),
        },
    }


@mcp.tool()
async def get_task(ticket_id: int) -> Dict[str, Any]:
    """
    Retrieve full task details including comments

    Args:
        ticket_id: The ticket ID to retrieve

    Returns:
        Complete ticket information with comments
    """
    # Get ticket details
    ticket = await api_request("GET", f"/tickets/{ticket_id}")

    # Get comments for the ticket
    comments = await api_request("GET", f"/comments/ticket/{ticket_id}")

    return {
        "id": ticket["id"],
        "title": ticket["title"],
        "description": ticket["description"],
        "acceptance_criteria": ticket.get("acceptance_criteria"),
        "priority": ticket["priority"],
        "assignee": ticket["assignee"],
        "column": ticket["current_column"],
        "board_id": ticket["board_id"],
        "created_at": ticket["created_at"],
        "updated_at": ticket["updated_at"],
        "comments": [
            {
                "id": c["id"],
                "text": c["text"],
                "author": c["author"],
                "created_at": c["created_at"],
            }
            for c in comments
        ],
    }


@mcp.tool()
async def create_task(
    title: str,
    board_id: int,
    description: Optional[str] = None,
    acceptance_criteria: Optional[str] = None,
    priority: str = "medium",
    assignee: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new task via API

    Args:
        title: Task title (required)
        board_id: Board ID (required)
        description: Task description
        acceptance_criteria: Acceptance criteria
        priority: Priority level (low/medium/high/critical)
        assignee: Initial assignee

    Returns:
        Created task details
    """
    data = {
        "title": title,
        "board_id": board_id,
        "current_column": "Not Started",
        "priority": priority,
        "created_by": MCP_AGENT_USERNAME,
    }

    if description:
        data["description"] = description
    if acceptance_criteria:
        data["acceptance_criteria"] = acceptance_criteria
    if assignee:
        data["assignee"] = assignee

    result = await api_request("POST", "/tickets/", data)

    return {
        "id": result["id"],
        "title": result["title"],
        "description": result.get("description"),
        "priority": result["priority"],
        "board_id": result["board_id"],
        "column": result["current_column"],
        "message": f"Task '{title}' created successfully",
    }


@mcp.tool()
async def edit_task(
    ticket_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    acceptance_criteria: Optional[str] = None,
    priority: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Update task properties via API

    Args:
        ticket_id: Task ID to update (required)
        title: New title
        description: New description
        acceptance_criteria: New acceptance criteria
        priority: New priority

    Returns:
        Updated task details
    """
    data = {"changed_by": MCP_AGENT_USERNAME}

    if title is not None:
        data["title"] = title
    if description is not None:
        data["description"] = description
    if acceptance_criteria is not None:
        data["acceptance_criteria"] = acceptance_criteria
    if priority is not None:
        data["priority"] = priority

    result = await api_request("PUT", f"/tickets/{ticket_id}", data)

    return {
        "id": result["id"],
        "title": result["title"],
        "description": result.get("description"),
        "priority": result["priority"],
        "column": result["current_column"],
        "message": f"Task {ticket_id} updated successfully",
    }


@mcp.tool()
async def move_task(
    ticket_id: int,
    column: str,
) -> Dict[str, Any]:
    """
    Move task to a different column

    Args:
        ticket_id: Task ID to move (required)
        column: Target column name (required)

    Returns:
        Movement details
    """
    data = {
        "column": column,
        "moved_by": MCP_AGENT_USERNAME,
    }

    result = await api_request("POST", f"/tickets/{ticket_id}/move", data)

    return {
        "id": result["id"],
        "from_column": result.get("from_column", "Unknown"),
        "to_column": result["current_column"],
        "message": f"Task {ticket_id} moved to {column}",
    }


@mcp.tool()
async def claim_task(
    ticket_id: int,
    agent_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Claim a task for an agent

    Args:
        ticket_id: Task ID to claim (required)
        agent_id: Agent identifier (defaults to MCP Agent)

    Returns:
        Claim confirmation
    """
    agent_name = agent_id or MCP_AGENT_USERNAME

    # The claim endpoint expects agent_id as query parameter
    result = await api_request("POST", f"/tickets/{ticket_id}/claim?agent_id={agent_name}", {})

    return {
        "id": result["id"],
        "assignee": result["assignee"],
        "message": f"Task {ticket_id} claimed by {agent_name}",
    }


@mcp.tool()
async def add_comment(
    ticket_id: int,
    text: str,
    author: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Add a comment to a task

    Args:
        ticket_id: Task ID to comment on (required)
        text: Comment text (required)
        author: Comment author (defaults to MCP Agent)

    Returns:
        Created comment details
    """
    data = {
        "ticket_id": ticket_id,
        "text": text,
        "author": author or MCP_AGENT_USERNAME,
    }

    result = await api_request("POST", "/comments/", data)

    return {
        "id": result["id"],
        "ticket_id": result["ticket_id"],
        "text": result["text"],
        "author": result["author"],
        "created_at": result["created_at"],
        "message": f"Comment added to task {ticket_id}",
    }


@mcp.tool()
async def list_boards() -> List[Dict[str, Any]]:
    """
    List all available boards

    Returns:
        List of boards with their details
    """
    boards = await api_request("GET", "/boards/")

    return [
        {
            "id": b["id"],
            "name": b["name"],
            "description": b.get("description"),
            "columns": b.get("columns", []),
            "ticket_count": b.get("ticket_count", 0),
        }
        for b in boards
    ]


@mcp.tool()
async def get_board_tickets(board_id: int) -> Dict[str, Any]:
    """
    Get all tickets for a specific board

    Args:
        board_id: Board ID (required)

    Returns:
        Board details with all tickets
    """
    result = await api_request("GET", f"/boards/{board_id}/tickets")

    return {
        "board_id": result["board_id"],
        "board_name": result["board_name"],
        "total_tickets": result["total_tickets"],
        "tickets": [
            {
                "id": t["id"],
                "title": t["title"],
                "description": t.get("description"),
                "priority": t["priority"],
                "assignee": t.get("assignee"),
                "column": t["current_column"],
            }
            for t in result.get("tickets", [])
        ],
    }


@mcp.tool()
async def get_statistics(board_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Get statistics for boards and tickets

    Args:
        board_id: Optional board ID for board-specific stats

    Returns:
        Statistical summary
    """
    endpoint = f"/statistics/board/{board_id}" if board_id else "/statistics/summary"

    stats = await api_request("GET", endpoint)

    return stats


async def cleanup():
    """Cleanup function to close HTTP client"""
    await http_client.aclose()


# Export the MCP server
__all__ = ["mcp", "setup_mcp_server", "cleanup"]
