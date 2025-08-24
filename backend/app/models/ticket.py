from datetime import datetime, timezone
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class Ticket(SQLModel, table=True):
    __tablename__ = "tickets"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=200, index=True)
    description: Optional[str] = Field(default=None)
    acceptance_criteria: Optional[str] = Field(default=None)
    priority: str = Field(default="1.0", index=True)
    assignee: Optional[str] = Field(default=None, index=True)
    current_column: str = Field(default="Not Started", index=True)
    board_id: int = Field(foreign_key="boards.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    column_entered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    board: Optional["Board"] = Relationship(back_populates="tickets")
    comments: List["Comment"] = Relationship(back_populates="ticket")
    history: List["TicketHistory"] = Relationship(back_populates="ticket")

    def get_time_in_column(self) -> float:
        # Handle both timezone-aware and naive datetimes
        now = datetime.now(timezone.utc)
        column_time = self.column_entered_at

        # If column_entered_at is naive, assume it's UTC
        if column_time.tzinfo is None:
            column_time = column_time.replace(tzinfo=timezone.utc)

        return (now - column_time).total_seconds()
