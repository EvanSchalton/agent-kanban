from datetime import datetime
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


class Comment(SQLModel, table=True):
    __tablename__ = "comments"

    id: Optional[int] = Field(default=None, primary_key=True)
    ticket_id: int = Field(foreign_key="tickets.id", index=True)
    text: str
    author: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    ticket: Optional["Ticket"] = Relationship(back_populates="comments")
