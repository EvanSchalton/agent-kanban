# CRITICAL: Data Loss - Cards Disappearing After Refresh
## Agent Kanban Board - Database Being Recreated on Launch

**Date:** 2025-08-18
**Project Status:** CRITICAL DATA LOSS
**Mission:** Stop database recreation and preserve user data

## Critical Issue

### User Report
1. Edit a card and save
2. Refresh the page
3. **Card disappears completely** ❌

This indicates the database is being **wiped and recreated** on server restart or page refresh!

## Likely Root Causes

### 1. Database Recreation on Startup
```python
# DANGEROUS CODE - might be in app initialization
def init_db():
    Base.metadata.drop_all(bind=engine)  # DELETES ALL DATA!
    Base.metadata.create_all(bind=engine)  # Creates fresh tables

# Or using alembic incorrectly
alembic downgrade base  # Drops all tables
alembic upgrade head    # Recreates them empty
```

### 2. In-Memory Database
```python
# If using SQLite in-memory mode
engine = create_engine("sqlite:///:memory:")  # DATA LOST ON RESTART!

# Should be:
engine = create_engine("sqlite:///kanban.db")  # Persistent file
```

### 3. Database File Being Deleted
```python
# Dangerous startup code
if os.path.exists("kanban.db"):
    os.remove("kanban.db")  # WHY?!
```

### 4. Docker Volume Not Mounted
```yaml
# If running in Docker without persistent volume
# Data is lost when container restarts
volumes:
  - ./data:/app/data  # Need this!
```

## Investigation Steps

### 1. Check Database Configuration
```bash
# Find database URL configuration
grep -r "sqlite\|postgresql\|mysql" backend/ --include="*.py"

# Look for :memory: database
grep -r ":memory:" backend/

# Check for drop_all or recreate
grep -r "drop_all\|drop\|recreate" backend/
```

### 2. Check Initialization Code
```python
# Look in these files:
- backend/app/main.py
- backend/app/database.py
- backend/app/models/__init__.py
- backend/app/core/database.py
```

### 3. Monitor Database File
```bash
# Watch database file
watch -n 1 "ls -la *.db"

# Check if file is being deleted/recreated
stat kanban.db

# Monitor file access
lsof | grep kanban.db
```

### 4. Check Frontend State
```javascript
// Is frontend clearing localStorage?
localStorage.clear();  // Would lose client-side state

// Or resetting state on refresh?
const [tickets, setTickets] = useState([]);  // Starts empty every time
```

## Critical Fixes Needed

### 1. Stop Database Recreation
```python
# Change from:
def init_db():
    Base.metadata.drop_all(bind=engine)  # REMOVE THIS
    Base.metadata.create_all(bind=engine)

# To:
def init_db():
    # Only create tables if they don't exist
    Base.metadata.create_all(bind=engine, checkfirst=True)
```

### 2. Use Persistent Database
```python
# Ensure using file-based database
DATABASE_URL = "sqlite:///./kanban.db"  # Persistent file

# NOT
DATABASE_URL = "sqlite:///:memory:"  # Temporary!
```

### 3. Preserve Existing Data
```python
# On startup
def startup():
    # Check if database exists
    if not os.path.exists("kanban.db"):
        # Only create if doesn't exist
        Base.metadata.create_all(bind=engine)
        seed_initial_data()  # Optional
    else:
        # Database exists - DO NOTHING!
        logger.info("Using existing database")
```

### 4. Add Data Validation
```python
# After startup, verify data exists
def verify_data_persistence():
    tickets = db.query(Ticket).count()
    logger.info(f"Database has {tickets} tickets")
    if tickets == 0:
        logger.warning("Database appears empty!")
```

## Testing Requirements

### 1. Persistence Test
```bash
# Create a ticket
curl -X POST http://localhost:8000/api/tickets \
  -d '{"title":"Test Persistence"}'

# Note the ID returned (e.g., 123)

# Restart the server
# Ctrl+C to stop
# Start again

# Check if ticket still exists
curl http://localhost:8000/api/tickets/123

# Should return the ticket, not 404!
```

### 2. Database File Check
```bash
# Before creating ticket
ls -la kanban.db
# Note size and timestamp

# After creating ticket
ls -la kanban.db
# Size should increase

# After server restart
ls -la kanban.db
# Should be same file, not recreated
```

## Immediate Actions

1. **STOP any code that drops tables**
2. **Ensure database file persists**
3. **Remove any startup recreation logic**
4. **Test data survives restart**

## Priority Level

**CRITICAL - STOP ALL OTHER WORK**

This is data loss! Users are losing their work. This must be fixed immediately before any other features.

## Success Criteria

- ✅ Create a ticket
- ✅ Edit the ticket
- ✅ Restart server
- ✅ Refresh browser
- ✅ Ticket still exists with edits

---

*This is a critical data loss issue that must be fixed immediately*
