"""
Pytest configuration file for backend tests with isolated database fixtures.

Provides comprehensive test isolation to prevent production database pollution.
"""

import asyncio
import os
import shutil
from collections.abc import Generator
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

# Set testing environment immediately
os.environ["TESTING"] = "true"

# Test database directory - relative to backend directory
TEST_DB_DIR = Path(__file__).parent.parent / "test_databases"


@pytest.fixture(scope="session", autouse=True)
def test_session_setup():
    """Setup and teardown for entire test session."""
    # Create test database directory
    if TEST_DB_DIR.exists():
        shutil.rmtree(TEST_DB_DIR)
    TEST_DB_DIR.mkdir(parents=True, exist_ok=True)

    yield

    # Cleanup all test databases after session
    if TEST_DB_DIR.exists():
        shutil.rmtree(TEST_DB_DIR, ignore_errors=True)

    # Also cleanup any stray test databases in backend directory
    import glob

    backend_dir = Path(__file__).parent.parent
    for f in glob.glob(str(backend_dir / "test_*.db")):
        try:
            os.remove(f)
        except:
            pass
    for f in glob.glob(str(backend_dir / "*.test.db")):
        try:
            os.remove(f)
        except:
            pass


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def memory_db():
    """Provide in-memory database for fast tests."""

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables
    SQLModel.metadata.create_all(engine)

    SessionLocal = Session
    session = SessionLocal(engine)

    yield session

    session.close()
    engine.dispose()


@pytest.fixture
def file_db():
    """Provide file-based database for debugging."""

    # Generate unique database name
    db_name = TEST_DB_DIR / f"test_{uuid4().hex[:8]}.db"
    engine = create_engine(
        f"sqlite:///{db_name}",
        connect_args={"check_same_thread": False},
    )

    # Create all tables
    SQLModel.metadata.create_all(engine)

    SessionLocal = Session
    session = SessionLocal(engine)

    yield session

    session.close()
    engine.dispose()

    # Note: File will be cleaned up by session fixture


@pytest.fixture(name="engine")
def engine_fixture(request):
    """Create database engine based on test requirements."""
    if request.node.get_closest_marker("debug"):
        # Use file-based DB for debugging
        db_name = TEST_DB_DIR / f"test_{uuid4().hex[:8]}.db"
        engine = create_engine(
            f"sqlite:///{db_name}",
            connect_args={"check_same_thread": False},
        )
    else:
        # Default to in-memory for speed
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

    # Import models to ensure they're registered

    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture(name="session")
def session_fixture(engine) -> Generator[Session, None, None]:
    """Create a database session for testing."""
    with Session(engine) as session:
        yield session


@pytest.fixture(name="db")
def db_fixture(request) -> Generator[Session, None, None]:
    """Smart fixture that chooses DB type based on marker.

    Usage:
        - Default: Uses in-memory database for speed
        - @pytest.mark.debug: Uses file-based database for debugging
        - @pytest.mark.file_db: Explicitly uses file-based database
    """

    if request.node.get_closest_marker("debug") or request.node.get_closest_marker("file_db"):
        # Use file-based DB for debugging
        db_name = TEST_DB_DIR / f"test_{uuid4().hex[:8]}.db"
        engine = create_engine(
            f"sqlite:///{db_name}",
            connect_args={"check_same_thread": False},
        )
    else:
        # Default to fast in-memory DB
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

    # Create all tables
    SQLModel.metadata.create_all(engine)

    SessionLocal = Session
    session = SessionLocal(engine)

    yield session

    session.close()
    engine.dispose()


@pytest.fixture(name="client")
def client_fixture(session: Session) -> Generator[TestClient, None, None]:
    """Create a test client for the FastAPI application with isolated database."""
    try:
        from backend.app.core.database import get_session
        from backend.app.main import app
    except ImportError:
        # If main.py doesn't exist yet, return None
        yield None
        return

    def get_session_override():
        return session

    # Override the database dependency
    app.dependency_overrides[get_session] = get_session_override

    client = TestClient(app)
    yield client

    # Clear overrides after test
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def protect_production_db(monkeypatch):
    """Automatically protect production database from test access.

    This fixture runs automatically for every test to ensure
    production database is never accidentally accessed.
    """
    # Set testing flag
    monkeypatch.setenv("TESTING", "true")

    # Optionally override DATABASE_URL to prevent any access
    # Only do this if we detect an attempt to use production DB
    original_db_url = os.getenv("DATABASE_URL", "")
    if "agent_kanban.db" in original_db_url and "test" not in original_db_url:
        # Force a test database URL
        test_db = TEST_DB_DIR / f"test_safety_{uuid4().hex[:8]}.db"
        monkeypatch.setenv("DATABASE_URL", f"sqlite:///{test_db}")

    yield

    # Cleanup is handled by monkeypatch automatically


@pytest.fixture
def sample_board_data():
    """Sample board data for testing."""
    return {"name": "Test Board", "description": "A test kanban board for testing"}


@pytest.fixture
def sample_column_data():
    """Sample column data for testing."""
    return [
        {"name": "Not Started", "position": 0, "wip_limit": None},
        {"name": "In Progress", "position": 1, "wip_limit": 3},
        {"name": "Review", "position": 2, "wip_limit": 2},
        {"name": "Done", "position": 3, "wip_limit": None},
    ]


@pytest.fixture
def sample_ticket_data():
    """Sample ticket data for testing."""
    return {
        "title": "Test Task",
        "description": "This is a test task for testing",
        "priority": "1.0",
        "assignee": None,
        "tags": ["test", "backend"],
        "story_points": 3,
    }


@pytest.fixture
def sample_comment_data():
    """Sample comment data for testing."""
    return {"content": "This is a test comment", "author": "test-agent"}


@pytest.fixture
async def websocket_client(test_client):
    """
    Create a WebSocket test client for testing WebSocket endpoints.

    This fixture provides a context manager for WebSocket connections
    that can be used in tests to validate real-time functionality.
    """
    from contextlib import contextmanager

    @contextmanager
    def _websocket_connect(path="/api/websocket/connect", **params):
        """
        Connect to WebSocket endpoint with optional parameters.

        Args:
            path: WebSocket endpoint path
            **params: Query parameters (client_id, board_id, username)
        """
        with test_client.websocket_connect(path, params=params) as websocket:
            yield websocket

    return _websocket_connect


@pytest.fixture
def performance_threshold():
    """Performance thresholds for testing."""
    return {
        "api_response_time": 0.2,  # 200ms max
        "websocket_latency": 1.0,  # 1 second max
        "max_concurrent_agents": 20,
        "max_tasks": 500,
    }


# Markers for test categories
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: mark test as a unit test")
    config.addinivalue_line("markers", "integration: mark test as an integration test")
    config.addinivalue_line("markers", "performance: mark test as a performance test")
    config.addinivalue_line("markers", "security: mark test as a security test")
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line(
        "markers", "debug: use file-based database for debugging (can inspect DB after test)"
    )
    config.addinivalue_line(
        "markers", "file_db: explicitly use file-based database instead of in-memory"
    )


# Add safety check to prevent accidental production DB usage
def pytest_runtest_setup(item):
    """Run before each test to ensure safety."""
    # Double-check that we're in test mode
    if os.getenv("TESTING") != "true":
        os.environ["TESTING"] = "true"

    # Check if any test is trying to use production database
    db_url = os.getenv("DATABASE_URL", "")
    if "agent_kanban.db" in db_url and "test" not in db_url:
        pytest.fail(
            "CRITICAL: Test attempting to use production database! "
            "Database isolation not working properly."
        )
