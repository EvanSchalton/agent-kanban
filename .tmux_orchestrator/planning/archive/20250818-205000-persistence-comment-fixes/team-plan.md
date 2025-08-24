# Team Plan: Database Persistence & Comment Fixes
## Mission: Fix backend database commits and comment functionality

### Project Manager Configuration
```yaml
name: persistence-fix-pm
session: persist-fix:1
goal: Fix critical backend issues - edits not persisting to database and comments failing completely
priority: CRITICAL - Data loss occurring
estimated_time: 2 hours
```

## Team Composition

### 1. Backend Developer (be)
**Role:** Fix database persistence and comment endpoint
```yaml
name: backend-dev
expertise: Python, FastAPI, SQLAlchemy, Database transactions
responsibilities:
  - Debug why updates don't persist to database
  - Add explicit db.commit() calls where missing
  - Fix comment endpoint (POST /api/tickets/{id}/comments)
  - Add comprehensive logging for all database operations
  - Verify each change with direct database queries
  - Test transaction isolation levels
tools: python, fastapi, sqlalchemy, sqlite3, logs
```

### 2. Database Specialist (db)
**Role:** Ensure database operations work correctly
```yaml
name: database-specialist
expertise: SQLAlchemy, SQLite/PostgreSQL, Transactions, Data integrity
responsibilities:
  - Review SQLAlchemy session configuration
  - Check transaction scope and lifecycle
  - Monitor database writes in real-time
  - Verify foreign key constraints
  - Add database triggers for audit logging
  - Test with raw SQL to bypass ORM
tools: sqlite3, database monitors, sql clients
```

### 3. QA Engineer (qa)
**Role:** Verify all fixes with thorough testing
```yaml
name: qa-engineer
expertise: API testing, Database verification, Persistence testing
responsibilities:
  - Test every update operation
  - Verify data in database after each operation
  - Test comment functionality via API
  - Document exact reproduction steps
  - Create automated persistence tests
  - Verify fixes survive server restart
tools: curl, postman, pytest, database tools
```

## Workflow Phases

### Phase 1: Immediate Diagnosis (20 min)
**Lead:** Backend Developer
**Critical First Steps:**

1. **Test current update endpoint:**
```bash
# Update a ticket
curl -X PUT http://localhost:8000/api/tickets/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"TEST PERSISTENCE"}'

# Check database immediately
sqlite3 kanban.db "SELECT title FROM tickets WHERE id=1"
```

2. **Check for missing commits:**
```python
# In tickets.py PUT endpoint
print(f"BEFORE COMMIT: {ticket.title}")
db.commit()  # IS THIS LINE PRESENT?
print(f"AFTER COMMIT: {ticket.title}")
db.refresh(ticket)
```

3. **Test comment endpoint:**
```bash
curl -X POST http://localhost:8000/api/tickets/1/comments \
  -H "Content-Type: application/json" \
  -d '{"text":"Test comment","author":"tester"}'
```

### Phase 2: Fix Implementation (40 min)
**Parallel Work:**

#### Backend Fixes:
```python
# Ensure EVERY update has explicit commit
@router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, update_data: dict, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()

    # Update fields
    for field, value in update_data.items():
        setattr(ticket, field, value)

    # CRITICAL: Explicit commit and logging
    try:
        db.commit()
        db.refresh(ticket)
        logger.info(f"✅ Ticket {ticket_id} updated and committed")

        # Verify persistence
        verify = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        logger.info(f"✅ Verified in DB: {verify.title}")

    except Exception as e:
        logger.error(f"❌ Commit failed: {e}")
        db.rollback()
        raise

    return ticket
```

#### Database Fixes:
```python
# Fix session configuration
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()  # Auto-commit on success
    except:
        db.rollback()
        raise
    finally:
        db.close()
```

#### Comment Endpoint:
```python
@router.post("/tickets/{ticket_id}/comments")
async def add_comment(ticket_id: int, comment_data: dict, db: Session = Depends(get_db)):
    comment = Comment(
        ticket_id=ticket_id,
        text=comment_data["text"],
        author=comment_data.get("author", "Anonymous"),
        created_at=datetime.now()
    )
    db.add(comment)
    db.commit()  # EXPLICIT COMMIT
    db.refresh(comment)
    return comment
```

### Phase 3: Verification Testing (30 min)
**Lead:** QA Engineer

1. **Persistence Test Suite:**
```python
def test_update_persistence():
    # Update ticket
    response = api.put("/tickets/1", {"title": "Updated"})
    assert response.status_code == 200

    # Check database directly
    db_result = db.execute("SELECT title FROM tickets WHERE id=1")
    assert db_result[0]["title"] == "Updated"

    # Restart server
    restart_server()

    # Verify still there
    response = api.get("/tickets/1")
    assert response.json()["title"] == "Updated"
```

2. **Comment Test:**
```python
def test_comment_creation():
    response = api.post("/tickets/1/comments", {
        "text": "Test comment",
        "author": "QA"
    })
    assert response.status_code == 201

    # Verify in database
    comments = db.execute("SELECT * FROM comments WHERE ticket_id=1")
    assert len(comments) > 0
```

### Phase 4: Final Validation (30 min)
**All Team:**
1. Manual testing of all operations
2. Database monitoring during operations
3. Server restart and verification
4. Load testing for transaction issues

## Critical Debugging Commands

### Monitor Database Writes
```bash
# Watch database file for changes
watch -n 1 "ls -la kanban.db; sqlite3 kanban.db 'SELECT COUNT(*) FROM tickets'"

# Monitor specific ticket
sqlite3 kanban.db "SELECT * FROM tickets WHERE id=1"

# Check last modified
stat kanban.db
```

### Test Endpoints
```bash
# Update test
curl -X PUT http://localhost:8000/api/tickets/1 \
  -d '{"title":"MUST PERSIST"}' \
  -H "Content-Type: application/json" \
  -v

# Comment test
curl -X POST http://localhost:8000/api/tickets/1/comments \
  -d '{"text":"Test","author":"QA"}' \
  -H "Content-Type: application/json" \
  -v
```

## Success Metrics
- [ ] Updates persist in database (verified with direct SQL)
- [ ] Updates survive server restart
- [ ] Comments can be added successfully
- [ ] All changes visible after browser refresh
- [ ] No data loss in any scenario
- [ ] Database file timestamp updates on changes

## Communication Protocol
- Use session `persist-fix:1`
- Report every successful database write
- Share SQL verification queries
- Alert on any rollback detected

## Contingency Plans

### If Commits Still Don't Work
- Switch to explicit transaction management
- Use raw SQL instead of ORM
- Change database engine (SQLite → PostgreSQL)
- Add database triggers for debugging

### If Comments Complex
- Start with minimal comment (just text)
- Remove foreign key constraints temporarily
- Create comments table if missing

## Timeline
- Total estimated: 2 hours
- Checkpoint 1: Issue diagnosed (20 min)
- Checkpoint 2: Fixes implemented (60 min)
- Checkpoint 3: All tests passing (120 min)

## Handoff Criteria
Project complete when:
1. Edit a ticket → Refresh → Changes persist
2. Add a comment → Works without error
3. Database file shows recent modifications
4. Direct SQL queries confirm all data saved
5. Server restart doesn't lose any data

---
*Critical backend team for fixing data persistence issues*
