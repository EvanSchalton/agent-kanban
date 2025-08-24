# Test Database Isolation Briefing
## Agent Kanban Board - Separate Test Databases & Cleanup

**Date:** 2025-08-19
**Project Status:** Tests Polluting Production Database
**Mission:** Isolate test databases and implement automatic cleanup

## Current Problem

Tests are using the production database (`agent_kanban.db`), causing:
- **2,254 test tickets** accumulated in production database
- **Database bloat** (2.8MB of test data)
- **Risk of data loss** if tests drop tables
- **Unpredictable test results** due to existing data

## Solution Strategy

### 1. Unique Database Per Test Run
```python
# Each test run gets a unique database
test_db_name = f"test_{uuid.uuid4().hex[:8]}.db"
# e.g., test_a3f2b8c1.db
```

### 2. Fixture-Based Database Creation
```python
@pytest.fixture
def test_db():
    """Create a fresh database for each test."""
    db_name = f"test_{uuid.uuid4().hex[:8]}.db"
    engine = create_engine(f"sqlite:///{db_name}")

    # Create all tables
    Base.metadata.create_all(engine)

    yield engine

    # Cleanup after test
    engine.dispose()
    os.remove(db_name)
```

### 3. Test Session Database
```python
@pytest.fixture(scope="session")
def session_db():
    """One database for entire test session."""
    db_name = f"test_session_{timestamp}.db"

    yield db_name

    # Cleanup all test databases after session
    for f in glob.glob("test_*.db"):
        os.remove(f)
```

## Implementation Plan

### Option 1: In-Memory Database (Fastest)
```python
# conftest.py
@pytest.fixture
def db():
    """Use in-memory database for each test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        yield session

    # Automatically cleaned up when connection closes
```

**Pros:**
- Super fast (RAM-based)
- No cleanup needed
- Perfect isolation

**Cons:**
- Can't inspect database after test failure
- Different from production SQLite file

### Option 2: Temporary File Database
```python
# conftest.py
import tempfile

@pytest.fixture
def db():
    """Use temporary file database for each test."""
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
        db_path = tmp.name

    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)

    yield engine

    # Cleanup
    engine.dispose()
    os.remove(db_path)
```

**Pros:**
- Can inspect on failure (with delete=False)
- Same as production (file-based)
- Automatic cleanup

### Option 3: Test Directory with Cleanup
```python
# conftest.py
TEST_DB_DIR = "test_databases"

@pytest.fixture(autouse=True, scope="session")
def cleanup_test_databases():
    """Clean up test databases before and after test session."""
    # Clean before tests
    if os.path.exists(TEST_DB_DIR):
        shutil.rmtree(TEST_DB_DIR)
    os.makedirs(TEST_DB_DIR, exist_ok=True)

    yield

    # Clean after tests
    shutil.rmtree(TEST_DB_DIR, ignore_errors=True)

@pytest.fixture
def db():
    """Create test database in dedicated directory."""
    db_name = f"{TEST_DB_DIR}/test_{uuid.uuid4().hex}.db"
    engine = create_engine(f"sqlite:///{db_name}")
    Base.metadata.create_all(engine)

    yield engine

    engine.dispose()
    # Individual cleanup optional - session cleanup will get it
```

**Pros:**
- All test DBs in one place
- Easy to inspect/debug
- Batch cleanup

## Configuration Changes

### 1. Environment Variable Check
```python
# app/core/config.py
class Settings:
    @property
    def database_url(self):
        if os.getenv("TESTING"):
            # Never use production DB in tests
            raise ValueError("Tests must provide their own database")
        return os.getenv("DATABASE_URL", "sqlite:///agent_kanban.db")
```

### 2. Test Configuration Override
```python
# tests/conftest.py
@pytest.fixture(autouse=True)
def set_test_env(monkeypatch):
    """Ensure tests never use production database."""
    monkeypatch.setenv("TESTING", "true")
    monkeypatch.delenv("DATABASE_URL", raising=False)
```

### 3. Database Factory
```python
# tests/factories/database.py
class TestDatabaseFactory:
    @staticmethod
    def create_memory_db():
        """Create in-memory database."""
        return create_engine("sqlite:///:memory:")

    @staticmethod
    def create_file_db():
        """Create file-based test database."""
        name = f"test_{uuid.uuid4().hex}.db"
        return create_engine(f"sqlite:///{name}"), name

    @staticmethod
    def cleanup_test_dbs():
        """Remove all test databases."""
        for f in glob.glob("test_*.db"):
            try:
                os.remove(f)
            except:
                pass  # Ignore errors
```

## Testing Patterns

### 1. Isolated Unit Tests
```python
def test_create_ticket(db):  # db fixture provides fresh database
    ticket = Ticket(title="Test")
    db.add(ticket)
    db.commit()

    assert db.query(Ticket).count() == 1
    # Database destroyed after test
```

### 2. Integration Tests
```python
@pytest.mark.integration
def test_full_workflow(session_db):  # Shared for related tests
    # Create ticket
    ticket_id = create_ticket(session_db, "Test")

    # Move ticket
    move_ticket(session_db, ticket_id, "In Progress")

    # Verify
    ticket = get_ticket(session_db, ticket_id)
    assert ticket.column == "In Progress"
```

### 3. Performance Tests
```python
@pytest.mark.performance
def test_bulk_operations(db):
    # Create many tickets
    for i in range(1000):
        db.add(Ticket(title=f"Test {i}"))
    db.commit()

    # Test query performance
    start = time.time()
    tickets = db.query(Ticket).all()
    duration = time.time() - start

    assert duration < 1.0  # Should be fast
    # Database with 1000 tickets destroyed after test
```

## Migration Steps

1. **Add test database fixtures** to conftest.py
2. **Update all tests** to use fixtures instead of default DB
3. **Add cleanup hooks** for test databases
4. **Protect production database** from test access
5. **Add CI/CD cleanup** steps

## Benefits

1. **No more test data pollution**
2. **Faster tests** (especially with in-memory)
3. **Predictable test results**
4. **Safe to run tests anytime**
5. **Easy cleanup** (just delete test_*.db files)

## Success Criteria

- ✅ Tests never touch `agent_kanban.db`
- ✅ Each test has isolated database
- ✅ All test databases cleaned up after run
- ✅ Tests run faster than before
- ✅ Can run tests repeatedly without side effects

---

*This briefing outlines the strategy to isolate test databases and prevent production database pollution*
