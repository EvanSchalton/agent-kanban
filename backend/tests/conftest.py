"""
Test fixtures and configuration for backend tests.
Provides isolated databases for each test to prevent production database pollution.
"""

import os
import shutil
from pathlib import Path
from typing import Generator
from uuid import uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, SQLModel

# Set testing environment IMMEDIATELY
os.environ["TESTING"] = "true"

# Test database directory
TEST_DB_DIR = Path(__file__).parent / "test_databases"


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

    # Also cleanup any stray test databases
    import glob

    for f in glob.glob("test_*.db"):
        try:
            os.remove(f)
        except Exception:
            pass
    for f in glob.glob("*.test.db"):
        try:
            os.remove(f)
        except Exception:
            pass


@pytest.fixture
def memory_db() -> Generator[Session, None, None]:
    """Provide in-memory database for fast tests."""
    # Import models to ensure they're registered

    # Create in-memory engine
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    # Create all tables
    SQLModel.metadata.create_all(engine)

    # Create session
    SessionLocal = sessionmaker(bind=engine, class_=Session)
    session = SessionLocal()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def file_db() -> Generator[Session, None, None]:
    """Provide file-based database for debugging."""
    # Import models to ensure they're registered

    # Create unique database file
    db_name = TEST_DB_DIR / f"test_{uuid4().hex[:8]}.db"
    engine = create_engine(f"sqlite:///{db_name}", connect_args={"check_same_thread": False})

    # Create all tables
    SQLModel.metadata.create_all(engine)

    # Create session
    SessionLocal = sessionmaker(bind=engine, class_=Session)
    session = SessionLocal()

    # Log the database file for debugging
    print(f"Test database created: {db_name}")

    try:
        yield session
    finally:
        session.close()
        engine.dispose()
        # File will be cleaned up by session fixture


@pytest.fixture
def db(request) -> Generator[Session, None, None]:
    """Smart fixture that chooses DB type based on marker."""
    if request.node.get_closest_marker("debug"):
        # Use file DB for tests marked with @pytest.mark.debug
        # Import models to ensure they're registered

        # Create unique database file
        db_name = TEST_DB_DIR / f"test_{uuid4().hex[:8]}.db"
        engine = create_engine(f"sqlite:///{db_name}", connect_args={"check_same_thread": False})

        # Create all tables
        SQLModel.metadata.create_all(engine)

        # Create session
        SessionLocal = sessionmaker(bind=engine, class_=Session)
        session = SessionLocal()

        # Log the database file for debugging
        print(f"Test database created: {db_name}")

        try:
            yield session
        finally:
            session.close()
            engine.dispose()
    else:
        # Default to fast in-memory DB
        # Import models to ensure they're registered

        # Create in-memory engine
        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

        # Create all tables
        SQLModel.metadata.create_all(engine)

        # Create session
        SessionLocal = sessionmaker(bind=engine, class_=Session)
        session = SessionLocal()

        try:
            yield session
        finally:
            session.close()
            engine.dispose()


@pytest.fixture
def test_client(db: Session):
    """Create a test client with database override."""
    from fastapi.testclient import TestClient

    from app.core.database import get_session
    from app.main import app

    # Override the get_session dependency
    def override_get_session():
        try:
            yield db
        finally:
            pass  # Session cleanup handled by fixture

    app.dependency_overrides[get_session] = override_get_session

    client = TestClient(app)
    yield client

    # Clean up overrides
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db: Session):
    """Create a test user for authentication tests."""
    from app.core.auth import get_password_hash
    from app.models import Role, User

    # Create a basic role if it doesn't exist
    role = db.query(Role).filter_by(name="user").first()
    if not role:
        role = Role(
            name="user",
            description="Basic user role",
            permissions=["read:tickets", "write:tickets"],
        )
        db.add(role)
        db.commit()

    # Create test user
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("testpassword"),
        is_active=True,
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return user


@pytest.fixture
def auth_headers(test_client, test_user, db: Session):
    """Get authentication headers for test requests."""
    from app.core.auth import create_access_token

    # Create access token
    access_token = create_access_token(data={"sub": test_user.username, "user_id": test_user.id})

    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def test_board(db: Session):
    """Create a test board."""
    import json

    from app.models import Board

    board = Board(
        name="Test Board",
        description="Test board for testing",
        columns=json.dumps(["Not Started", "In Progress", "Done"]),
    )
    db.add(board)
    db.commit()
    db.refresh(board)

    return board


@pytest.fixture
def test_ticket(db: Session, test_board, test_user):
    """Create a test ticket."""
    from app.models import Ticket

    ticket = Ticket(
        title="Test Ticket",
        description="Test ticket description",
        status="todo",
        priority="medium",
        board_id=test_board.id,
        assignee_id=test_user.id,
        reporter_id=test_user.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return ticket


# Custom markers
def pytest_configure(config):
    """Register custom pytest markers."""
    config.addinivalue_line("markers", "debug: mark test to use file-based database for debugging")
    config.addinivalue_line("markers", "performance: mark test as performance test")
    config.addinivalue_line("markers", "integration: mark test as integration test")


# Ensure test environment is set
def pytest_sessionstart(session):
    """Called before test session starts."""
    os.environ["TESTING"] = "true"
    # Set a test-specific database URL to avoid using production
    if "DATABASE_URL" not in os.environ:
        os.environ["DATABASE_URL"] = "sqlite:///:memory:"
