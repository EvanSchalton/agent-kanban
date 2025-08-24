# Team Plan: CRITICAL Data Loss Fix
## Mission: Stop database recreation and test database conflicts

### Project Manager Configuration
```yaml
name: data-loss-pm
session: critical-fix:1
goal: Fix critical data loss - cards disappearing after refresh, likely due to database recreation or test/prod database conflicts
priority: CRITICAL - Data loss occurring
estimated_time: 1 hour (urgent fix)
```

## Team Composition

### 1. Database Engineer (db) - LEAD
**Role:** Find and fix database recreation/clearing issues
```yaml
name: database-engineer
expertise: SQLAlchemy, Database Management, SQLite, Data Persistence
responsibilities:
  - Find where database is being dropped/recreated
  - Check if tests use same database as production
  - Ensure database file persists between restarts
  - Remove any drop_all or recreate commands
  - Separate test and production databases
  - Add data persistence validation
tools: python, sqlalchemy, sqlite3, database inspection
```

### 2. Backend Developer (be)
**Role:** Fix initialization and startup code
```yaml
name: backend-dev
expertise: Python, FastAPI, Application Initialization
responsibilities:
  - Review app startup sequence
  - Remove dangerous initialization code
  - Ensure database only created if doesn't exist
  - Fix any state management issues
  - Add logging to track database operations
  - Check for test/prod environment mixing
tools: python, fastapi, logging
```

### 3. DevOps Engineer (do)
**Role:** Ensure proper environment separation
```yaml
name: devops-engineer
expertise: Environment Configuration, Docker, Testing Infrastructure
responsibilities:
  - Separate test and production databases
  - Check Docker volume mounting
  - Ensure database file permissions
  - Monitor database file changes
  - Set up proper environment variables
  - Prevent test runs from affecting prod data
tools: docker, environment configs, file monitoring
```

## Workflow Phases

### Phase 1: URGENT Investigation (10 min)
**All team members investigate in parallel:**

1. **Database Engineer - Check for recreation:**
```bash
# Find dangerous code
grep -r "drop_all\|DROP TABLE\|truncate" backend/
grep -r ":memory:" backend/
grep -r "Base.metadata.drop" backend/

# Check database configuration
find backend -name "*.py" -exec grep -l "create_engine\|DATABASE_URL" {} \;
```

2. **Backend Dev - Check initialization:**
```python
# Look in these files immediately:
# backend/app/main.py
# backend/app/core/database.py
# backend/app/db/base.py
# backend/run.py

# Look for:
@app.on_event("startup")
def startup():
    # Is this dropping tables?
    init_db()
```

3. **DevOps - Check test/prod separation:**
```bash
# Check test configuration
cat backend/tests/conftest.py
grep -r "TEST_DATABASE\|test.db" backend/tests/

# Check if tests use same database
grep -r "kanban.db" backend/tests/

# Check environment variables
env | grep DATABASE
```

### Phase 2: Critical Fixes (20 min)
**Implement fixes based on findings:**

#### Fix 1: Stop Database Recreation
```python
# backend/app/core/database.py or similar
# REMOVE or comment out:
# Base.metadata.drop_all(bind=engine)  # DELETE THIS LINE!

# Change to:
def init_db(engine):
    # Only create tables if they don't exist
    Base.metadata.create_all(bind=engine, checkfirst=True)
    # Do NOT drop tables!
```

#### Fix 2: Separate Test Database
```python
# backend/tests/conftest.py
@pytest.fixture(scope="session")
def db():
    # Use separate test database!
    TEST_DATABASE_URL = "sqlite:///./test_kanban.db"  # Different file!
    # Or in-memory for tests only
    TEST_DATABASE_URL = "sqlite:///:memory:"

    engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(bind=engine)

    # Cleanup after tests
    yield session
    Base.metadata.drop_all(bind=engine)  # Only drop TEST database
```

#### Fix 3: Persistent Production Database
```python
# backend/app/core/config.py
class Settings:
    # Ensure using file-based database for production
    DATABASE_URL: str = "sqlite:///./kanban.db"  # Persistent file

    # For tests, use different database
    if os.getenv("TESTING"):
        DATABASE_URL = "sqlite:///./test_kanban.db"
```

#### Fix 4: Add Startup Validation
```python
# backend/app/main.py
@app.on_event("startup")
async def startup():
    # Check if database exists
    db_exists = os.path.exists("kanban.db")

    if db_exists:
        logger.info("Using existing database")
        # Count existing records
        with SessionLocal() as db:
            ticket_count = db.query(Ticket).count()
            logger.info(f"Database has {ticket_count} existing tickets")
    else:
        logger.info("Creating new database")
        Base.metadata.create_all(bind=engine, checkfirst=True)

    # NEVER drop tables on startup!
```

### Phase 3: Test Isolation (15 min)
**Lead:** DevOps Engineer

1. **Create test database configuration:**
```python
# backend/app/core/test_config.py
TEST_SETTINGS = {
    "DATABASE_URL": "sqlite:///./test_kanban.db",
    "TESTING": True
}
```

2. **Update test fixtures:**
```python
# backend/tests/conftest.py
@pytest.fixture(autouse=True)
def use_test_database(monkeypatch):
    """Ensure tests never touch production database"""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./test_kanban.db")
    monkeypatch.setenv("TESTING", "true")
```

3. **Add safety check:**
```python
# backend/app/core/database.py
def get_database_url():
    if os.getenv("TESTING"):
        return "sqlite:///./test_kanban.db"
    else:
        return os.getenv("DATABASE_URL", "sqlite:///./kanban.db")

# Never allow tests to use production database
assert "test" in get_database_url() if os.getenv("TESTING") else True
```

### Phase 4: Verification (10 min)
**All team members:**

1. **Test data persistence:**
```bash
# Create a ticket
curl -X POST http://localhost:8000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Persistence Test","description":"Must survive restart"}'

# Note the ID (e.g., 1234)

# Stop server (Ctrl+C)
# Start server again
python backend/run.py

# Check ticket still exists
curl http://localhost:8000/api/tickets/1234
# Should return ticket, not 404!
```

2. **Verify test isolation:**
```bash
# Run tests
cd backend && pytest

# Check production database unchanged
sqlite3 kanban.db "SELECT COUNT(*) FROM tickets;"
# Count should be same as before tests
```

3. **Monitor database file:**
```bash
# In separate terminal
watch -n 1 "ls -la *.db && sqlite3 kanban.db 'SELECT COUNT(*) FROM tickets;'"

# Should see:
# - kanban.db stays same size
# - test_kanban.db created during tests
# - Ticket count doesn't change
```

### Phase 5: Add Safeguards (5 min)
**Lead:** Database Engineer

```python
# backend/app/core/database.py
class DatabaseSafety:
    @staticmethod
    def prevent_data_loss():
        """Never allow production database to be dropped"""
        if not os.getenv("TESTING"):
            # In production, never drop tables
            Base.metadata.drop_all = lambda *args, **kwargs: None
            logger.warning("Attempted to drop production tables - blocked!")
```

## Success Metrics
- [ ] Create ticket, restart server, ticket persists
- [ ] Edit ticket, refresh page, edits persist
- [ ] Run tests, production data unchanged
- [ ] No drop_all or recreate in production code
- [ ] Separate test and production databases
- [ ] Database file not deleted on startup

## CRITICAL Commands

### Immediate Check
```bash
# Is database being recreated?
ls -la kanban.db && date
# Restart server
# Check again
ls -la kanban.db && date
# Timestamp should be OLD, not new!
```

### Test Isolation Check
```bash
# Before running tests
sqlite3 kanban.db "SELECT COUNT(*) FROM tickets;"
# Run tests
pytest
# After tests
sqlite3 kanban.db "SELECT COUNT(*) FROM tickets;"
# Count should be SAME!
```

## Emergency Rollback
If fixes cause issues:
1. Backup current database: `cp kanban.db kanban.backup.db`
2. Apply fixes
3. Test thoroughly
4. If problems: `cp kanban.backup.db kanban.db`

## Timeline
- Phase 1: Investigation (10 min) - URGENT
- Phase 2: Critical fixes (30 min)
- Phase 3: Test isolation (45 min)
- Phase 4: Verification (55 min)
- Phase 5: Safeguards (60 min)

**Total: 1 hour maximum - CRITICAL PRIORITY**

---
*Critical data loss team - must fix immediately before any other work*
