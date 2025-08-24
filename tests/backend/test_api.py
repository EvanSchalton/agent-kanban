"""Test API endpoints."""

from contextlib import asynccontextmanager

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from src.backend.api import boards, tickets, websocket
from src.backend.database import get_session

# Create test engine
test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Test application lifespan."""
    # Create tables
    SQLModel.metadata.create_all(test_engine)
    yield
    # Cleanup
    pass


# Create test app
test_app = FastAPI(lifespan=lifespan)
test_app.include_router(boards.router, prefix="/api/boards", tags=["boards"])
test_app.include_router(tickets.router, prefix="/api/tickets", tags=["tickets"])
test_app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


@test_app.get("/")
async def root():
    return {"name": "Agent Kanban Board API"}


@test_app.get("/health")
async def health():
    return {"status": "healthy"}


@pytest.fixture
def client():
    """Create a test client with test database."""

    def get_test_session():
        with Session(test_engine) as session:
            yield session

    test_app.dependency_overrides[get_session] = get_test_session

    with TestClient(test_app) as client:
        yield client

    test_app.dependency_overrides.clear()


def test_root_endpoint(client):
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert data["name"] == "Agent Kanban Board API"


def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_create_board(client):
    """Test creating a board."""
    board_data = {
        "name": "Test Board",
        "description": "A test board",
        "column_names": ["To Do", "In Progress", "Done"],
    }

    response = client.post("/api/boards/", json=board_data)
    assert response.status_code == 201

    data = response.json()
    assert data["name"] == "Test Board"
    assert data["description"] == "A test board"
    assert "id" in data


def test_get_boards(client):
    """Test getting all boards."""
    # Create a board first
    board_data = {"name": "Test Board", "column_names": ["To Do"]}
    client.post("/api/boards/", json=board_data)

    # Get all boards
    response = client.get("/api/boards/")
    assert response.status_code == 200

    boards = response.json()
    assert len(boards) >= 1
    assert boards[0]["name"] == "Test Board"


def test_create_ticket(client):
    """Test creating a ticket."""
    # Create board and columns first
    board_data = {"name": "Test Board", "column_names": ["To Do", "Done"]}
    board_response = client.post("/api/boards/", json=board_data)
    board_id = board_response.json()["id"]

    # Get columns
    columns_response = client.get(f"/api/boards/{board_id}/columns")
    column_id = columns_response.json()[0]["id"]

    # Create ticket
    ticket_data = {
        "title": "Test Task",
        "description": "Test description",
        "priority": "1.0",
        "column_id": column_id,
    }

    response = client.post(f"/api/tickets/?board_id={board_id}", json=ticket_data)
    assert response.status_code == 201

    data = response.json()
    assert data["title"] == "Test Task"
    assert data["description"] == "Test description"
    assert data["priority"] == "1.0"


def test_update_ticket(client):
    """Test updating a ticket."""
    # Setup
    board_data = {"name": "Test Board", "column_names": ["To Do"]}
    board_response = client.post("/api/boards/", json=board_data)
    board_id = board_response.json()["id"]

    ticket_data = {"title": "Original Title"}
    ticket_response = client.post(f"/api/tickets/?board_id={board_id}", json=ticket_data)
    ticket_id = ticket_response.json()["id"]

    # Update ticket
    update_data = {"title": "Updated Title"}
    response = client.put(f"/api/tickets/{ticket_id}", json=update_data)
    assert response.status_code == 200

    data = response.json()
    assert data["title"] == "Updated Title"


def test_add_comment(client):
    """Test adding a comment to a ticket."""
    # Setup
    board_data = {"name": "Test Board", "column_names": ["To Do"]}
    board_response = client.post("/api/boards/", json=board_data)
    board_id = board_response.json()["id"]

    ticket_data = {"title": "Test Task"}
    ticket_response = client.post(f"/api/tickets/?board_id={board_id}", json=ticket_data)
    ticket_id = ticket_response.json()["id"]

    # Add comment
    comment_data = {"text": "This is a test comment", "author": "test-agent"}

    response = client.post(f"/api/tickets/{ticket_id}/comments", json=comment_data)
    assert response.status_code == 201

    data = response.json()
    assert data["text"] == "This is a test comment"
    assert data["author"] == "test-agent"
