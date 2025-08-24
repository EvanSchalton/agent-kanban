from datetime import datetime

from pydantic import BaseModel


class CommentBase(BaseModel):
    ticket_id: int
    text: str
    author: str


class CommentCreate(CommentBase):
    pass


class CommentResponse(CommentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
