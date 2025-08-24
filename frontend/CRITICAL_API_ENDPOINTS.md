# CRITICAL API ENDPOINTS FOR FRONTEND

## 🔴 HISTORY ENDPOINTS (Priority - 9 failures)

### 1. Ticket History

**Endpoint:** `GET /api/tickets/{id}/history`
**Purpose:** Show ticket movement timeline in TicketHistory component
**Expected Response:**

```json
[
  {
    "id": "uuid",
    "ticket_id": "ticket-id",
    "from_column": "not_started",
    "to_column": "in_progress",
    "moved_at": "2025-08-18T10:00:00Z",
    "moved_by": "username",
    "duration_in_previous": 86400000
  }
]
```

**Used By:** `TicketHistory.tsx` component

### 2. Board Activity Log

**Endpoint:** `GET /api/boards/{id}/activity`
**Purpose:** Show recent board activities
**Expected Response:**

```json
{
  "activities": [
    {
      "id": "uuid",
      "type": "ticket_moved",
      "ticket_id": "123",
      "user": "dev1",
      "details": {
        "from": "in_progress",
        "to": "done"
      },
      "timestamp": "2025-08-18T10:00:00Z"
    }
  ],
  "total": 50
}
```

**Used By:** Activity feed in dashboard

### 3. Column History Statistics

**Endpoint:** `GET /api/columns/{id}/history`
**Purpose:** Show column performance over time
**Expected Response:**

```json
{
  "column_id": "in_progress",
  "history": [
    {
      "date": "2025-08-18",
      "ticket_count": 12,
      "avg_time_hours": 48,
      "tickets_completed": 5
    }
  ]
}
```

## 📊 STATISTICS ENDPOINTS (9 failures)

### 1. Board Statistics

**Endpoint:** `GET /api/boards/{id}/statistics`
**Purpose:** Display in StatisticsDashboard component
**Expected Response:**

```json
{
  "total_tickets": 42,
  "completion_rate": 28.6,
  "avg_cycle_time_hours": 96,
  "tickets_by_column": {
    "not_started": 8,
    "in_progress": 12,
    "blocked": 3,
    "done": 12
  },
  "column_statistics": [
    {
      "column_name": "In Progress",
      "avg_time_hours": 48,
      "std_dev_hours": 12,
      "min_time_hours": 24,
      "max_time_hours": 120
    }
  ]
}
```

**Used By:** `StatisticsDashboard.tsx`

### 2. Ticket Statistics

**Endpoint:** `GET /api/tickets/{id}/statistics`
**Purpose:** Individual ticket performance metrics
**Expected Response:**

```json
{
  "ticket_id": "123",
  "total_time_hours": 120,
  "time_by_column": {
    "not_started": 24,
    "in_progress": 72,
    "done": 24
  },
  "move_count": 3,
  "comment_count": 5
}
```

## ✅ BULK OPERATIONS (3 failures remaining)

### 1. Bulk Move (Might be partially working)

**Endpoint:** `POST /api/tickets/bulk/move`
**Request:**

```json
{
  "ticket_ids": [1, 2, 3],
  "target_column": "in_progress"
}
```

**Used By:** `BulkActions.tsx`

### 2. Bulk Unassign

**Endpoint:** `POST /api/tickets/bulk/unassign`
**Request:**

```json
{
  "ticket_ids": [1, 2, 3]
}
```

**Used By:** `BulkActions.tsx`

### 3. Bulk Delete

**Endpoint:** `DELETE /api/tickets/bulk`
**Request:**

```json
{
  "ticket_ids": [1, 2, 3]
}
```

## 🔌 WEBSOCKET (1 failure)

**Endpoint:** `WS /ws/connect`
**Purpose:** Real-time updates
**Expected Messages:**

```json
{
  "event": "ticket_updated",
  "data": {
    "ticket_id": "123",
    "changes": {...}
  }
}
```

**Used By:** `useWebSocket.ts` hook

---

## IMPLEMENTATION PRIORITY

1. **FIRST:** History endpoints (GET operations, easier to implement)
2. **SECOND:** Statistics endpoints (GET operations, calculations)
3. **THIRD:** Fix remaining bulk operations
4. **LAST:** WebSocket connection

## TESTING ENDPOINTS

Use the test page at `/workspaces/agent-kanban/frontend/api-test.html` to verify each endpoint as it's implemented.
