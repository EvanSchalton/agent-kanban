# BACKEND QUICK FIX GUIDE

## The endpoints EXIST but need GET handlers

All return 405 (Method Not Allowed) which means the routes are defined but missing the GET method implementation.

## Priority 1: History Endpoints (9 test failures)

### 1. Add GET handler to `/api/tickets/{id}/history`

```python
@router.get("/tickets/{ticket_id}/history")
async def get_ticket_history(
    ticket_id: int,
    db: Session = Depends(get_db)
):
    # Return ticket movement history
    history = db.query(TicketHistory).filter(
        TicketHistory.ticket_id == ticket_id
    ).order_by(TicketHistory.timestamp).all()

    return [
        {
            "id": h.id,
            "ticket_id": h.ticket_id,
            "from_column": h.from_column,
            "to_column": h.to_column,
            "moved_at": h.timestamp,
            "duration_in_previous": h.duration_ms
        }
        for h in history
    ]
```

### 2. Add GET handler to `/api/boards/{id}/activity`

```python
@router.get("/boards/{board_id}/activity")
async def get_board_activity(
    board_id: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    # Return recent board activities
    # Query ticket movements, comments, etc.
    pass
```

### 3. Add GET handler to `/api/boards/{id}/statistics`

```python
@router.get("/boards/{board_id}/statistics")
async def get_board_statistics(
    board_id: int,
    db: Session = Depends(get_db)
):
    # Calculate and return board statistics
    tickets = db.query(Ticket).filter(Ticket.board_id == board_id).all()

    return {
        "total_tickets": len(tickets),
        "completion_rate": calculate_completion_rate(tickets),
        "avg_cycle_time_hours": calculate_avg_cycle_time(tickets),
        "tickets_by_column": count_by_column(tickets)
    }
```

## These are likely POST-only endpoints that need GET methods added

The 405 status confirms the routes exist - they just need the GET handlers implemented.
