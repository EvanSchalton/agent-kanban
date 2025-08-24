"""Test database models."""

import pytest
from sqlmodel import Session, SQLModel, create_engine

from src.backend.models import Board, BoardColumn, Comment, Ticket


@pytest.fixture
def session():
    """Create a test database session."""
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        yield session


def test_board_creation(session):
    """Test creating a board."""
    board = Board(name="Test Board", description="A test board")
    session.add(board)
    session.commit()

    assert board.id is not None
    assert board.name == "Test Board"
    assert board.description == "A test board"


def test_column_creation(session):
    """Test creating columns."""
    board = Board(name="Test Board")
    session.add(board)
    session.flush()

    column = BoardColumn(board_id=board.id, name="To Do", position=0)
    session.add(column)
    session.commit()

    assert column.id is not None
    assert column.name == "To Do"
    assert column.position == 0


def test_ticket_creation(session):
    """Test creating a ticket."""
    # Create board and column
    board = Board(name="Test Board")
    session.add(board)
    session.flush()

    column = BoardColumn(board_id=board.id, name="To Do", position=0)
    session.add(column)
    session.flush()

    # Create ticket
    ticket = Ticket(
        board_id=board.id,
        column_id=column.id,
        title="Test Task",
        description="Test description",
        priority="1.0",
        assignee="agent-1",
    )
    session.add(ticket)
    session.commit()

    assert ticket.id is not None
    assert ticket.title == "Test Task"
    assert ticket.priority == "1.0"
    assert ticket.assignee == "agent-1"


def test_ticket_column_update(session):
    """Test updating ticket column."""
    # Setup
    board = Board(name="Test Board")
    session.add(board)
    session.flush()

    col1 = BoardColumn(board_id=board.id, name="To Do", position=0)
    col2 = BoardColumn(board_id=board.id, name="In Progress", position=1)
    session.add_all([col1, col2])
    session.flush()

    ticket = Ticket(board_id=board.id, column_id=col1.id, title="Test Task")
    session.add(ticket)
    session.commit()

    # Update column
    original_time = ticket.time_entered_column
    ticket.update_column(col2.id)
    session.commit()

    assert ticket.column_id == col2.id
    assert ticket.time_entered_column > original_time


def test_comment_creation(session):
    """Test creating a comment."""
    # Setup
    board = Board(name="Test Board")
    session.add(board)
    session.flush()

    column = BoardColumn(board_id=board.id, name="To Do", position=0)
    session.add(column)
    session.flush()

    ticket = Ticket(board_id=board.id, column_id=column.id, title="Test Task")
    session.add(ticket)
    session.flush()

    # Create comment
    comment = Comment(ticket_id=ticket.id, text="This is a test comment", author="agent-1")
    session.add(comment)
    session.commit()

    assert comment.id is not None
    assert comment.text == "This is a test comment"
    assert comment.author == "agent-1"
