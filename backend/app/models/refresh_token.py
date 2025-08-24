from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", nullable=False, index=True)
    token: str = Field(unique=True, index=True, nullable=False)
    expires_at: datetime = Field(nullable=False)
    revoked: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "token": "refresh_token_example",
                "expires_at": "2025-08-17T12:00:00",
                "revoked": False,
            }
        }
