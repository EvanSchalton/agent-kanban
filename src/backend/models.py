"""Database models for Agent Kanban Board."""

from datetime import datetime

from sqlalchemy import Text
from sqlmodel import Column, Field, Relationship, SQLModel


class Board(SQLModel, table=True):
    """Board model representing a kanban board."""

    __tablename__ = "boards"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    columns: list["BoardColumn"] = Relationship(back_populates="board", cascade_delete=True)
    tickets: list["Ticket"] = Relationship(back_populates="board", cascade_delete=True)


class BoardColumn(SQLModel, table=True):
    """Column model representing a column in a kanban board."""

    __tablename__ = "board_columns"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id")
    name: str = Field(max_length=100)
    position: int = Field(description="Order position of the column")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    board: Board = Relationship(back_populates="columns")
    tickets: list["Ticket"] = Relationship(back_populates="column")


class Ticket(SQLModel, table=True):
    """Ticket model representing a task in the kanban board."""

    __tablename__ = "tickets"

    id: int | None = Field(default=None, primary_key=True)
    board_id: int = Field(foreign_key="boards.id")
    column_id: int = Field(foreign_key="board_columns.id")
    title: str = Field(max_length=200)
    description: str | None = Field(default=None, sa_column=Column(Text))
    acceptance_criteria: str | None = Field(default=None, sa_column=Column(Text))
    priority: str = Field(default="1.0", description="Multi-decimal priority (e.g., 1.0.1.0.0.1)")
    assignee: str | None = Field(default=None, max_length=100, description="Agent ID or username")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    time_entered_column: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    board: Board = Relationship(back_populates="tickets")
    column: BoardColumn = Relationship(back_populates="tickets")
    comments: list["Comment"] = Relationship(back_populates="ticket", cascade_delete=True)
    history: list["TicketHistory"] = Relationship(back_populates="ticket", cascade_delete=True)

    def update_column(self, new_column_id: int) -> None:
        """Update ticket column and reset time entered."""
        self.column_id = new_column_id
        self.time_entered_column = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def get_time_in_column(self) -> float:
        """Get time spent in current column in seconds."""
        delta = datetime.utcnow() - self.time_entered_column
        return delta.total_seconds()


class Comment(SQLModel, table=True):
    """Comment model for ticket comments."""

    __tablename__ = "comments"

    id: int | None = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="tickets.id")
    text: str = Field(sa_column=Column(Text))
    author: str = Field(max_length=100, description="Agent ID or human username")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    ticket: Ticket = Relationship(back_populates="comments")


class TicketHistory(SQLModel, table=True):
    """History model tracking ticket state changes."""

    __tablename__ = "ticket_history"

    id: int | None = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="tickets.id")
    field_name: str = Field(max_length=50, description="Field that changed")
    old_value: str | None = Field(default=None, sa_column=Column(Text))
    new_value: str | None = Field(default=None, sa_column=Column(Text))
    changed_by: str = Field(max_length=100, description="Who made the change")
    changed_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    ticket: Ticket = Relationship(back_populates="history")


# Response models (without relationships to avoid circular references)
class BoardResponse(SQLModel):
    """Board response model."""

    id: int
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ColumnResponse(SQLModel):
    """Column response model."""

    id: int
    board_id: int
    name: str
    position: int
    created_at: datetime


class TicketResponse(SQLModel):
    """Ticket response model."""

    id: int
    board_id: int
    column_id: int
    title: str
    description: str | None
    acceptance_criteria: str | None
    priority: str
    assignee: str | None
    created_at: datetime
    updated_at: datetime
    time_entered_column: datetime
    time_in_column: float | None = None


class CommentResponse(SQLModel):
    """Comment response model."""

    id: int
    ticket_id: int
    text: str
    author: str
    created_at: datetime


class HistoryResponse(SQLModel):
    """History response model."""

    id: int
    ticket_id: int
    field_name: str
    old_value: str | None
    new_value: str | None
    changed_by: str
    changed_at: datetime


# Create models for API requests
class BoardCreate(SQLModel):
    """Model for creating a board."""

    name: str = Field(max_length=200)
    description: str | None = None
    column_names: list[str] = Field(
        default=["Not Started", "In Progress", "Blocked", "Ready for QC", "Done"]
    )


class ColumnCreate(SQLModel):
    """Model for creating a column."""

    name: str = Field(max_length=100)
    position: int | None = None


class TicketCreate(SQLModel):
    """Model for creating a ticket."""

    title: str = Field(max_length=200)
    description: str | None = None
    acceptance_criteria: str | None = None
    priority: str = Field(default="1.0")
    assignee: str | None = None
    column_id: int | None = None


class TicketUpdate(SQLModel):
    """Model for updating a ticket."""

    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    acceptance_criteria: str | None = None
    priority: str | None = None
    assignee: str | None = None
    column_id: int | None = None


class CommentCreate(SQLModel):
    """Model for creating a comment."""

    text: str
    author: str
