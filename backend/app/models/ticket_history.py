from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class TicketHistory(SQLModel, table=True):
    __tablename__ = "ticket_history"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="tickets.id", index=True)
    field_name: str = Field(index=True)
    old_value: Optional[str] = Field(default=None)
    new_value: Optional[str] = Field(default=None)
    changed_by: str = Field(index=True)
    changed_at: datetime = Field(default_factory=datetime.utcnow)

    ticket: Optional["Ticket"] = Relationship(back_populates="history")
