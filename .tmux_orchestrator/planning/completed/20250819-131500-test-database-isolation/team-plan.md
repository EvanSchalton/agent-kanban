# Team Plan: Test Database Isolation
## Mission: Implement test fixtures with isolated databases and automatic cleanup

### Project Manager Configuration
```yaml
name: test-isolation-pm
session: test-fix:1
goal: Isolate test databases from production, implement fixtures for each test, and automatic cleanup
priority: HIGH - Prevents data corruption and test pollution
estimated_time: 2 hours
```

## Team Composition

### 1. Test Engineer (te) - LEAD
**Role:** Redesign test infrastructure with database isolation
```yaml
name: test-engineer
expertise: pytest, Test Fixtures, Database Testing, Test Isolation
responsibilities:
  - Create database fixtures in conftest.py
  - Implement in-memory option for speed
  - Implement file-based option for debugging
  - Set up automatic cleanup
  - Update all existing tests to use fixtures
  - Add test database factory
tools: pytest, python, sqlite, test frameworks
```

### 2. Backend Developer (be)
**Role:** Protect production database and update configuration
```yaml
name: backend-dev
expertise: Python, FastAPI, SQLAlchemy, Configuration Management
responsibilities:
  - Add TESTING environment variable checks
  - Prevent production database access during tests
  - Update database configuration
  - Ensure proper session management
  - Add database URL validation
tools: python, fastapi, sqlalchemy, environment configs
```

### 3. DevOps Engineer (do)
**Role:** CI/CD and cleanup automation
```yaml
name: devops-engineer
expertise: CI/CD, GitHub Actions, File Management, Automation
responsibilities:
  - Update CI/CD to clean test databases
  - Add pre/post test cleanup scripts
  - Monitor disk space during tests
  - Set up test database directory
  - Add cleanup to .gitignore
tools: github actions, bash, file management
```

## Workflow Phases

### Phase 1: Protect Production Database (20 min)
**Lead:** Backend Developer

1. **Add protection in config:**
```python
# backend/app/core/config.py
import os

class Settings:
    @property
    def database_url(self):
        # CRITICAL: Prevent tests from using production DB
        if os.getenv("TESTING") == "true":
            # Tests must provide their own database
            return None  # Force tests to provide DB

        # Production/dev database
        return os.getenv("DATABASE_URL", "sqlite:///agent_kanban.db")

settings = Settings()
```

2. **Add safety check:**
```python
# backend/app/core/database.py
def get_db_url():
    if os.getenv("TESTING") == "true":
        if "agent_kanban.db" in str(engine.url):
            raise RuntimeError("CRITICAL: Tests attempting to use production database!")
    return settings.database_url
```

### Phase 2: Create Test Fixtures (30 min)
**Lead:** Test Engineer

1. **Create comprehensive conftest.py:**
```python
# backend/tests/conftest.py
import os
import pytest
import tempfile
import shutil
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

# Set testing environment
os.environ["TESTING"] = "true"

# Test database directory
TEST_DB_DIR = "test_databases"

@pytest.fixture(scope="session", autouse=True)
def test_session_setup():
    """Setup and teardown for entire test session."""
    # Create test database directory
    if os.path.exists(TEST_DB_DIR):
        shutil.rmtree(TEST_DB_DIR)
    os.makedirs(TEST_DB_DIR)

    yield

    # Cleanup all test databases after session
    shutil.rmtree(TEST_DB_DIR, ignore_errors=True)

    # Also cleanup any stray test databases
    import glob
    for f in glob.glob("test_*.db"):
        try:
            os.remove(f)
        except:
            pass

@pytest.fixture
def memory_db():
    """Provide in-memory database for fast tests."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    yield session

    session.close()
    engine.dispose()

@pytest.fixture
def file_db():
    """Provide file-based database for debugging."""
    db_name = f"{TEST_DB_DIR}/test_{uuid4().hex[:8]}.db"
    engine = create_engine(f"sqlite:///{db_name}")
    Base.metadata.create_all(engine)

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    yield session

    session.close()
    engine.dispose()
    # File will be cleaned up by session fixture

@pytest.fixture
def db(request):
    """Smart fixture that chooses DB type based on marker."""
    if request.node.get_closest_marker("debug"):
        # Use file DB for tests marked with @pytest.mark.debug
        yield from file_db()
    else:
        # Default to fast in-memory DB
        yield from memory_db()

# Override app's get_db for tests
@pytest.fixture(autouse=True)
def override_get_db(db):
    """Automatically override FastAPI's database dependency."""
    from app.api.deps import get_db as original_get_db

    app.dependency_overrides[original_get_db] = lambda: db
    yield
    app.dependency_overrides.clear()
```

### Phase 3: Update Existing Tests (40 min)
**Lead:** Test Engineer

1. **Update test files to use fixtures:**
```python
# backend/tests/test_tickets.py
# BEFORE:
def test_create_ticket():
    db = get_db()  # Used production database!
    ticket = Ticket(title="Test")
    db.add(ticket)
    db.commit()

# AFTER:
def test_create_ticket(db):  # Uses fixture
    ticket = Ticket(title="Test")
    db.add(ticket)
    db.commit()
    assert db.query(Ticket).count() == 1
```

2. **Add markers for special cases:**
```python
@pytest.mark.debug  # Use file DB for debugging
def test_complex_workflow(db):
    # This test will use file-based DB
    # Can inspect database after test
    pass

@pytest.mark.performance
def test_bulk_operations(memory_db):  # Explicitly use memory
    # Always use memory for performance tests
    for i in range(1000):
        memory_db.add(Ticket(title=f"Test {i}"))
    memory_db.commit()
```

### Phase 4: Add Cleanup Scripts (20 min)
**Lead:** DevOps Engineer

1. **Create cleanup script:**
```bash
#!/bin/bash
# scripts/cleanup_test_dbs.sh

echo "Cleaning up test databases..."

# Remove test database directory
rm -rf test_databases/

# Remove any stray test databases
rm -f test_*.db

# Remove pytest cache
rm -rf .pytest_cache/

echo "Test cleanup complete"
```

2. **Update .gitignore:**
```gitignore
# Test databases
test_*.db
test_databases/
*.test.db
.pytest_cache/
```

3. **Add to CI/CD:**
```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd backend
    pytest

- name: Cleanup test databases
  if: always()  # Run even if tests fail
  run: |
    cd backend
    ./scripts/cleanup_test_dbs.sh
```

### Phase 5: Test the Test Infrastructure (20 min)
**Lead:** All Team

1. **Verify production DB protected:**
```bash
# This should fail
TESTING=true python -c "from app.core.database import engine; print(engine.url)"
# Should error if it contains agent_kanban.db
```

2. **Run tests with new fixtures:**
```bash
cd backend
pytest -v

# Check no production database touched
ls -la agent_kanban.db  # Should have old timestamp

# Check test databases created and cleaned
ls test_databases/  # Should be empty after tests
```

3. **Test cleanup:**
```bash
# Create some test databases
touch test_abc123.db test_xyz789.db

# Run cleanup
./scripts/cleanup_test_dbs.sh

# Verify cleaned
ls test_*.db  # Should show nothing
```

## Success Metrics
- [ ] Production database never modified by tests
- [ ] Each test gets fresh, isolated database
- [ ] Tests run faster with in-memory option
- [ ] All test databases cleaned up automatically
- [ ] Can run tests multiple times without issues
- [ ] File-based option available for debugging

## Testing Commands

### Run with different database types
```bash
# Default (in-memory)
pytest

# Force file-based for all tests
pytest --db-type=file

# Run specific test with debug database
pytest -m debug

# Check for database leaks
ls -la test_*.db test_databases/
```

## Rollback Plan
If new fixtures cause issues:
1. Keep old conftest.py backed up
2. Can temporarily use test_agent_kanban.db
3. Gradually migrate tests to new fixtures

## Timeline
- Phase 1: Protect production (20 min)
- Phase 2: Create fixtures (50 min)
- Phase 3: Update tests (90 min)
- Phase 4: Add cleanup (110 min)
- Phase 5: Test infrastructure (130 min)

**Total: ~2 hours**

---
*Test isolation team to prevent database pollution and improve test reliability*
