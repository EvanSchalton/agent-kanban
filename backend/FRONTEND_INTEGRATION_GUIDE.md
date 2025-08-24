# Frontend Integration Guide

**Agent Kanban Board API**
**Version:** v0.1.0
**Base URL:** `http://localhost:18000`
**Generated:** August 20, 2025

## Quick Start for Frontend Developers

### 🚀 API Overview

- **53 total endpoints** across 9 categories
- **REST API** with JSON request/response
- **WebSocket support** for real-time updates
- **JWT authentication** with refresh tokens
- **CORS enabled** for frontend integration

### 🔧 Base Configuration

```typescript
const API_BASE_URL = 'http://localhost:18000';
const WS_BASE_URL = 'ws://localhost:18000';

// Default headers
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

## Authentication System 🔐

### Registration & Login Flow

```typescript
// 1. Register new user
POST /api/auth/register
{
  "username": "string",
  "email": "user@example.com",
  "password": "string"
}
// Response: 201 Created + UserResponse

// 2. Login
POST /api/auth/login
{
  "username": "string",
  "password": "string"
}
// Response: { "access_token": "...", "refresh_token": "...", "token_type": "bearer" }

// 3. Get current user
GET /api/auth/me
Authorization: Bearer <access_token>
// Response: UserResponse

// 4. Refresh token
POST /api/auth/refresh
{
  "refresh_token": "string"
}
// Response: New access token
```

### Authentication Headers

```typescript
const authHeaders = {
  ...headers,
  'Authorization': `Bearer ${accessToken}`
};
```

## Core API Endpoints 📋

### Boards Management (17 endpoints)

#### Get All Boards

```typescript
GET /api/boards/
// Response: BoardResponse[]
// Each board includes: id, name, description, columns, ticket_count
```

#### Create Board

```typescript
POST /api/boards/
{
  "name": "My Board",
  "description": "Board description",
  "columns": ["To Do", "In Progress", "Done"] // Optional
}
// Response: BoardResponse with generated ID
```

#### Board Operations

```typescript
// Get single board
GET /api/boards/{board_id}

// Update board
PUT /api/boards/{board_id}
{
  "name": "Updated name",
  "description": "Updated description"
}

// Delete board
DELETE /api/boards/{board_id}

// Get board tickets
GET /api/boards/{board_id}/tickets

// Manage columns
GET /api/boards/{board_id}/columns
PUT /api/boards/{board_id}/columns
{
  "columns": ["Backlog", "Active", "Testing", "Done"]
}
```

### Tickets Management (11 endpoints)

#### Get Tickets (Paginated)

```typescript
GET /api/tickets/?board_id={board_id}&page=1&page_size=50
// Optional filters: column, assignee
// Response: PaginatedResponse<TicketResponse>
{
  "items": TicketResponse[],
  "total": number,
  "page": number,
  "page_size": number,
  "total_pages": number,
  "has_next": boolean,
  "has_previous": boolean
}
```

#### Create Ticket

```typescript
POST /api/tickets/
{
  "title": "Ticket title",
  "description": "Detailed description",
  "board_id": number,
  "priority": "low" | "medium" | "high",
  "assignee": "username", // Optional
  "acceptance_criteria": "string" // Optional
}
// Response: 201 Created + TicketResponse
```

#### Ticket Operations

```typescript
// Get single ticket
GET /api/tickets/{ticket_id}

// Update ticket
PUT /api/tickets/{ticket_id}
{
  "title": "Updated title",
  "description": "Updated description",
  "priority": "high"
}

// Delete ticket
DELETE /api/tickets/{ticket_id}

// Move ticket (Drag & Drop)
POST /api/tickets/{ticket_id}/move
{
  "column": "In Progress",
  "position": 2 // Optional
}

// Claim ticket
POST /api/tickets/{ticket_id}/claim
{
  "assignee": "username"
}
```

### Comments System (2 endpoints)

```typescript
// Get ticket comments
GET /api/comments/ticket/{ticket_id}

// Create comment
POST /api/comments/
{
  "ticket_id": number,
  "content": "Comment text",
  "author": "username"
}

// Delete comment
DELETE /api/comments/{comment_id}
```

### Bulk Operations (4 endpoints)

```typescript
// Bulk move tickets
POST /api/bulk/tickets/move
{
  "ticket_ids": [1, 2, 3],
  "column": "Done"
}

// Bulk assign tickets
POST /api/bulk/tickets/assign
{
  "ticket_ids": [1, 2, 3],
  "assignee": "username"
}

// Bulk update priority
POST /api/bulk/tickets/priority
{
  "ticket_ids": [1, 2, 3],
  "priority": "high"
}

// Check bulk operation status
GET /api/bulk/operations/status
```

## Real-time Features 🔄

### WebSocket Integration

```typescript
// Connect to WebSocket
const socket = new WebSocket('ws://localhost:18000/ws/connect');

// Listen for events
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch(data.type) {
    case 'board_created':
      // Refresh board list
      break;
    case 'ticket_created':
      // Add ticket to board
      break;
    case 'ticket_moved':
      // Update ticket position
      break;
    case 'ticket_updated':
      // Update ticket details
      break;
  }
};
```

### WebSocket Management

```typescript
// Get connection stats
GET /ws/stats
// Response: { "active_connections": number, "total_messages": number }

// Cleanup inactive connections
POST /ws/cleanup

// Manual broadcast (admin)
POST /ws/broadcast
{
  "type": "custom_event",
  "data": { "message": "Custom data" }
}
```

## Statistics & Analytics 📊

### Board Statistics

```typescript
// Get board statistics
GET /api/statistics/boards/{board_id}/statistics
// Response: ticket counts, column distribution, performance metrics

// Get ticket color classifications
GET /api/statistics/boards/{board_id}/tickets/colors
// Response: color coding based on age, priority, etc.

// Real-time ticket colors
GET /api/statistics/boards/{board_id}/tickets/colors/realtime

// Column-specific statistics
GET /api/statistics/boards/{board_id}/column/{column_name}/statistics

// Drag & drop metrics
GET /api/statistics/boards/{board_id}/drag-drop/metrics
```

### System Statistics

```typescript
// Statistics health check
GET /api/statistics/statistics/health

// All drag & drop metrics
GET /api/statistics/drag-drop/metrics/all

// Clear caches
POST /api/statistics/statistics/cache/clear
POST /api/statistics/drag-drop/metrics/clear
```

## History & Audit Trail 📈

### Ticket History

```typescript
// Get ticket history
GET /api/history/tickets/{ticket_id}/history
// Response: chronological list of changes

// Get ticket transitions
GET /api/history/tickets/{ticket_id}/transitions
// Response: column movement history
```

### Board Activity

```typescript
// Get board activity
GET /api/history/boards/{board_id}/activity
// Response: recent activity on the board

// History statistics
GET /api/history/stats
// Response: system-wide activity statistics
```

## Health Monitoring 🏥

### Health Check Endpoints

```typescript
// Simple health check
GET /health
// Response: { "status": "healthy", "socketio": "available", "cors": "enabled" }

// Detailed health check
GET /health/detailed
// Response: comprehensive system status

// Memory health check
GET /health/memory
// Response: memory usage statistics

// API health check
GET /api/health/
GET /api/health/simple
```

## Error Handling 🚨

### Standard Error Response Format

```typescript
{
  "error_id": "err_1234567890123",
  "detail": "Human readable error message",
  "status_code": 400,
  "timestamp": "2025-08-20T13:29:48.554Z",
  "path": "/api/boards/",
  "method": "POST",
  "client_info": {
    "ip": "127.0.0.1",
    "user_agent": "Mozilla/5.0..."
  }
}
```

### Common Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `405` - Method Not Allowed
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limiting ⏱️

### Limits by Endpoint Type

- **Authentication:** 5 requests/hour (registration)
- **Standard API:** 100 requests/minute
- **Testing Mode:** 10,000 requests/minute
- **WebSocket:** No explicit limit

## Frontend Integration Examples 💻

### React/TypeScript Example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:18000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Board service
export const boardService = {
  async getBoards() {
    const response = await api.get('/api/boards/');
    return response.data;
  },

  async createBoard(data: BoardCreate) {
    const response = await api.post('/api/boards/', data);
    return response.data;
  },

  async getBoardTickets(boardId: number, page = 1) {
    const response = await api.get(`/api/tickets/?board_id=${boardId}&page=${page}`);
    return response.data;
  }
};

// WebSocket hook
export const useWebSocket = (onMessage: (data: any) => void) => {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:18000/ws/connect');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    return () => ws.close();
  }, [onMessage]);
};
```

### Vue.js Example

```javascript
// store/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:18000'
});

export const useKanbanAPI = () => {
  const getBoards = async () => {
    const { data } = await api.get('/api/boards/');
    return data;
  };

  const createTicket = async (ticketData) => {
    const { data } = await api.post('/api/tickets/', ticketData);
    return data;
  };

  return { getBoards, createTicket };
};
```

## Testing & Development 🧪

### API Testing Examples

```bash
# Test board creation
curl -X POST http://localhost:18000/api/boards/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Board","description":"API test"}'

# Test ticket creation
curl -X POST http://localhost:18000/api/tickets/ \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Ticket","board_id":1,"priority":"medium"}'

# Test health endpoint
curl http://localhost:18000/health
```

### OpenAPI Documentation

- **Interactive Docs:** <http://localhost:18000/docs>
- **OpenAPI Spec:** <http://localhost:18000/openapi.json>
- **ReDoc:** <http://localhost:18000/redoc> (if available)

## Performance Considerations 🚀

### Response Times (Benchmarked)

- **Health checks:** <1ms
- **Board operations:** 9-35ms
- **Ticket operations:** 15-20ms
- **Authentication:** <20ms

### Optimization Tips

1. **Use pagination** for ticket lists
2. **Cache board data** when possible
3. **Implement WebSocket** for real-time updates
4. **Use bulk operations** for multiple changes
5. **Monitor rate limits** to avoid throttling

## Production Deployment 🌐

### CORS Configuration

Frontend origins must be whitelisted. Current config supports:

- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (React dev server)

### Environment Variables

```env
DATABASE_URL=sqlite:///./agent_kanban.db
TESTING=false
CORS_ORIGINS=["http://localhost:5173","http://your-domain.com"]
```

## Support & Documentation 📚

- **API Documentation:** <http://localhost:18000/docs>
- **Health Status:** <http://localhost:18000/health>
- **WebSocket Stats:** <http://localhost:18000/ws/stats>
- **Backend Status:** All systems operational ✅

---

**Frontend Integration Status: READY FOR DEVELOPMENT** ✅

The Agent Kanban Board API provides comprehensive functionality for building modern Kanban applications with real-time features, robust authentication, and excellent performance characteristics.
