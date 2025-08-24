# Agent Kanban Board - Backend

## Overview

FastAPI backend for the Agent Kanban Board system, providing REST API, WebSocket support, and MCP server integration for AI agent task management.

## Features

- **REST API**: Full CRUD operations for boards, tickets, and comments
- **WebSocket Support**: Real-time updates for all board activities
- **MCP Server**: AI agent integration for task management
- **SQLite Database**: Persistent storage with SQLModel ORM
- **History Tracking**: Complete audit trail of all ticket changes

## Architecture

### Data Models

- **Board**: Configurable kanban boards with dynamic columns
- **Ticket**: Tasks with priority, assignment, and state tracking
- **Comment**: Timestamped comments with author attribution
- **TicketHistory**: Complete change history for audit trails

### API Endpoints

#### Boards

- `GET /api/boards/` - List all boards
- `GET /api/boards/{id}` - Get board details
- `POST /api/boards/` - Create new board
- `PUT /api/boards/{id}` - Update board
- `DELETE /api/boards/{id}` - Delete board
- `GET /api/boards/{id}/columns` - Get board columns
- `PUT /api/boards/{id}/columns` - Update board columns

#### Tickets

- `GET /api/tickets/` - List tickets with filters
- `GET /api/tickets/{id}` - Get ticket details
- `POST /api/tickets/` - Create new ticket
- `PUT /api/tickets/{id}` - Update ticket
- `POST /api/tickets/{id}/move` - Move ticket to new column
- `POST /api/tickets/{id}/claim` - Claim ticket for agent
- `DELETE /api/tickets/{id}` - Delete ticket

#### Comments

- `GET /api/comments/ticket/{id}` - Get ticket comments
- `POST /api/comments/` - Add comment
- `DELETE /api/comments/{id}` - Delete comment

#### WebSocket

- `/ws/connect` - WebSocket connection for real-time updates

### MCP Tools

- `list_tasks` - Query tasks with filters
- `get_task` - Get full task details
- `create_task` - Create new task
- `edit_task` - Update task properties
- `claim_task` - Assign task to agent
- `update_task_status` - Move task between columns
- `add_comment` - Add comment to task
- `list_columns` - Get board columns
- `get_board_state` - Get complete board state

## Installation

1. Install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

2. Run the server:

```bash
python run.py
```

The API will be available at `http://localhost:8000`

## Testing

Run the test script to verify database setup:

```bash
python test_backend.py
```

## WebSocket Events

The backend broadcasts the following events:

- `board_created` - New board created
- `board_updated` - Board modified
- `board_deleted` - Board removed
- `ticket_created` - New ticket added
- `ticket_updated` - Ticket modified
- `ticket_moved` - Ticket column changed
- `ticket_claimed` - Ticket assigned
- `ticket_deleted` - Ticket removed
- `comment_added` - New comment
- `comment_deleted` - Comment removed
- `columns_updated` - Board columns changed

## Configuration

Environment variables (`.env` file):

- `DATABASE_URL` - Database connection string (default: SQLite)
- `CORS_ORIGINS` - Allowed CORS origins for frontend

## Performance Targets

- API response time: < 200ms
- WebSocket latency: < 1 second
- Concurrent agents: 20+
- Active tasks: 500+
