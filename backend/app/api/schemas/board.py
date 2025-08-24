from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class BoardBase(BaseModel):
    name: str
    description: Optional[str] = None
    columns: Optional[List[str]] = None


class BoardCreate(BoardBase):
    pass


class BoardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    columns: Optional[List[str]] = None


class BoardResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    columns: List[str]
    created_at: datetime
    updated_at: datetime
    ticket_count: int = 0

    @classmethod
    def from_orm(cls, board):
        return cls(
            id=board.id,
            name=board.name,
            description=board.description,
            columns=board.get_columns_list(),
            created_at=board.created_at,
            updated_at=board.updated_at,
            ticket_count=getattr(board, "ticket_count", 0),
        )

    class Config:
        from_attributes = True
