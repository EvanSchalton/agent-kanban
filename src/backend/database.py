"""Database configuration and session management."""

import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlmodel import Session, SQLModel, create_engine

# Load environment variables
load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agent_kanban.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)


def init_db() -> None:
    """Initialize database and create all tables."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Get database session."""
    with Session(engine) as session:
        yield session


def create_default_board(session: Session) -> None:
    """Create a default board with standard columns."""
    from sqlmodel import select

    from .models import Board, BoardColumn

    # Check if a board already exists
    existing_board = session.exec(select(Board)).first()
    if existing_board:
        return

    # Create default board
    board = Board(name="Main Board", description="Default kanban board for agent task management")
    session.add(board)
    session.flush()  # Get the board ID

    # Create default columns
    default_columns = ["Not Started", "In Progress", "Blocked", "Ready for QC", "Done"]
    for position, column_name in enumerate(default_columns):
        column = BoardColumn(board_id=board.id, name=column_name, position=position)
        session.add(column)

    session.commit()
