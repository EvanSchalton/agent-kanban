# Agent Kanban Board API Documentation

## Base URL

- Development: `http://localhost:8000`
- WebSocket: `ws://localhost:8000/ws/connect`

## Authentication

Currently no authentication required (to be implemented)

## API Endpoints

### Health Check

#### GET /

Returns API status and version

```json
{
  "message": "Agent Kanban Board API",
  "version": "0.1.0"
}
```

#### GET /health

```json
{
  "status": "healthy"
}
```

### Board Management

#### GET /api/boards/

List all boards

- Response: Array of BoardResponse objects

```json
[
  {
    "id": 1,
    "name": "Development Board",
    "columns": "[\"Not Started\", \"In Progress\", \"Blocked\", \"Ready for QC\", \"Done\"]",
    "created_at": "2025-08-10T01:00:00",
    "updated_at": "2025-08-10T01:00:00"
  }
]
```

#### GET /api/boards/{board_id}

Get specific board details

- Path Parameters:
  - `board_id` (integer): Board ID
- Response: BoardResponse object

#### POST /api/boards/

Create new board

- Request Body:

```json
{
  "name": "Sprint Board",
  "columns": ["Backlog", "Sprint", "In Progress", "Review", "Done"]  // optional
}
```

- Response: BoardResponse object

#### PUT /api/boards/{board_id}

Update board details

- Path Parameters:
  - `board_id` (integer): Board ID
- Request Body:

```json
{
  "name": "Updated Board Name"
}
```

- Response: BoardResponse object

#### DELETE /api/boards/{board_id}

Delete a board

- Path Parameters:
  - `board_id` (integer): Board ID
- Response:

```json
{
  "message": "Board deleted successfully"
}
```

#### GET /api/boards/{board_id}/columns

Get board columns as array

- Path Parameters:
  - `board_id` (integer): Board ID
- Response: Array of strings

```json
["Not Started", "In Progress", "Blocked", "Ready for QC", "Done"]
```

#### PUT /api/boards/{board_id}/columns

Update board columns

- Path Parameters:
  - `board_id` (integer): Board ID
- Request Body: Array of column names (JSON array, not object)

```json
["Backlog", "Todo", "In Progress", "Testing", "Done"]
```

- Response:

```json
{
  "message": "Columns updated successfully",
  "columns": ["Backlog", "Todo", "In Progress", "Testing", "Done"]
}
```

### Ticket Management

#### GET /api/tickets/

List tickets with optional filters

- Query Parameters:
  - `board_id` (integer, optional): Filter by board
  - `column` (string, optional): Filter by column name
  - `assignee` (string, optional): Filter by assignee
- Response: Array of TicketResponse objects

```json
[
  {
    "id": 1,
    "title": "Implement login feature",
    "description": "Add OAuth2 authentication",
    "acceptance_criteria": "Users can log in with Google",
    "priority": "2.0",
    "assignee": "agent_001",
    "current_column": "In Progress",
    "board_id": 1,
    "created_at": "2025-08-10T01:00:00",
    "updated_at": "2025-08-10T01:00:00",
    "column_entered_at": "2025-08-10T01:00:00"
  }
]
```

#### GET /api/tickets/{ticket_id}

Get specific ticket details

- Path Parameters:
  - `ticket_id` (integer): Ticket ID
- Response: TicketResponse object

#### POST /api/tickets/

Create new ticket

- Request Body:

```json
{
  "board_id": 1,
  "title": "New Feature",
  "description": "Implement new feature",
  "acceptance_criteria": "Feature works as expected",
  "priority": "1.0",
  "assignee": "agent_001",  // optional
  "created_by": "pm_agent"  // optional
}
```

- Response: TicketResponse object

#### PUT /api/tickets/{ticket_id}

Update ticket details

- Path Parameters:
  - `ticket_id` (integer): Ticket ID
- Request Body (all fields optional):

```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "acceptance_criteria": "New criteria",
  "priority": "3.0",
  "assignee": "agent_002",
  "changed_by": "pm_agent"
}
```

- Response: TicketResponse object

#### POST /api/tickets/{ticket_id}/move

Move ticket to different column

- Path Parameters:
  - `ticket_id` (integer): Ticket ID
- Request Body:

```json
{
  "column": "In Progress",
  "moved_by": "agent_001"  // optional
}
```

- Response: TicketResponse object

#### POST /api/tickets/{ticket_id}/claim

Claim ticket for an agent

- Path Parameters:
  - `ticket_id` (integer): Ticket ID
- Query Parameters:
  - `agent_id` (string): Agent identifier
- No request body required
- Response: TicketResponse object
- Error: 400 if ticket already assigned

#### DELETE /api/tickets/{ticket_id}

Delete a ticket

- Path Parameters:
  - `ticket_id` (integer): Ticket ID
- Response:

```json
{
  "message": "Ticket deleted successfully"
}
```

### Comment Management

#### GET /api/comments/ticket/{ticket_id}

Get all comments for a ticket

- Path Parameters:
  - `ticket_id` (integer): Ticket ID
- Response: Array of CommentResponse objects

```json
[
  {
    "id": 1,
    "ticket_id": 1,
    "text": "Started working on this task",
    "author": "agent_001",
    "created_at": "2025-08-10T01:00:00"
  }
]
```

#### POST /api/comments/

Add comment to ticket

- Request Body:

```json
{
  "ticket_id": 1,
  "text": "Progress update: 50% complete",
  "author": "agent_001"
}
```

- Response: CommentResponse object

#### DELETE /api/comments/{comment_id}

Delete a comment

- Path Parameters:
  - `comment_id` (integer): Comment ID
- Response:

```json
{
  "message": "Comment deleted successfully"
}
```

## WebSocket Events

### Connection

Connect to: `ws://localhost:8000/ws/connect`

### Event Types

All events follow this structure:

```json
{
  "event": "event_type",
  "data": {
    // Event-specific data
  }
}
```

### Board Events

- `board_created`: New board created
- `board_updated`: Board details updated
- `board_deleted`: Board deleted
- `columns_updated`: Board columns changed

### Ticket Events

- `ticket_created`: New ticket created
- `ticket_updated`: Ticket details updated
- `ticket_moved`: Ticket moved to different column
- `ticket_claimed`: Ticket assigned to agent
- `ticket_deleted`: Ticket deleted

### Comment Events

- `comment_added`: New comment added
- `comment_deleted`: Comment deleted

## Data Models

### BoardResponse

```typescript
interface BoardResponse {
  id: number;
  name: string;
  columns: string;  // JSON string array
  created_at: string;  // ISO datetime
  updated_at: string;  // ISO datetime
}
```

### TicketResponse

```typescript
interface TicketResponse {
  id: number;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  priority: string;
  assignee: string | null;
  current_column: string;
  board_id: number;
  created_at: string;  // ISO datetime
  updated_at: string;  // ISO datetime
  column_entered_at: string;  // ISO datetime
}
```

### CommentResponse

```typescript
interface CommentResponse {
  id: number;
  ticket_id: number;
  text: string;
  author: string;
  created_at: string;  // ISO datetime
}
```

## Error Responses

All errors follow this structure:

```json
{
  "detail": "Error message"
}
```

Common HTTP status codes:

- 200: Success
- 201: Created
- 400: Bad Request
- 404: Not Found
- 422: Validation Error
- 500: Internal Server Error

## Performance Metrics

Current baseline (as of testing):

- Create ticket: ~17ms average
- Get ticket: ~5ms average
- Update ticket: ~16ms average
- List tickets: ~5ms average

## Known Issues

1. No authentication/authorization
2. SQLite may bottleneck with high concurrency
3. No rate limiting implemented
4. Priority field is string (should be enum/numeric)

## Future Enhancements

1. Add JWT authentication
2. Implement rate limiting
3. Add pagination for list endpoints
4. Add filtering/sorting options
5. Implement caching layer
6. Add database connection pooling
7. Convert to PostgreSQL for production
