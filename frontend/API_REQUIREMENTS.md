# Frontend API Requirements

## Current Working Endpoints ✅

- GET `/api/boards/{id}` - Get board details
- GET `/api/boards/{id}/tickets` - Get all tickets for a board
- PUT `/api/tickets/{id}` - Update ticket details
- POST `/api/tickets/{id}/move` - Move ticket to different column
- POST `/api/tickets/{id}/comments` - Add comment to ticket

## Required Bulk Operations Endpoints 🔄

- POST `/api/tickets/bulk/move` - Move multiple tickets

  ```json
  {
    "ticket_ids": ["id1", "id2"],
    "target_column": "in_progress"
  }
  ```

- POST `/api/tickets/bulk/assign` - Assign multiple tickets

  ```json
  {
    "ticket_ids": ["id1", "id2"],
    "assignee": "username"
  }
  ```

- POST `/api/tickets/bulk/delete` - Delete multiple tickets

  ```json
  {
    "ticket_ids": ["id1", "id2"]
  }
  ```

## WebSocket Endpoints 🔌

- WS `/ws/connect` - Real-time updates for ticket changes

## Statistics Endpoints 📊

- GET `/api/boards/{id}/statistics` - Get column time statistics
- GET `/api/tickets/{id}/history` - Get ticket movement history

## Current Integration Status

- Frontend: Running on port 15174 ✅
- Backend: Running on port 8000 ✅
- Proxy: Configured and working ✅
