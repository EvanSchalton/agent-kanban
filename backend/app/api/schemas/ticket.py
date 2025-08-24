from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, validator


class TicketBase(BaseModel):
    title: str = Field(max_length=200)
    description: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    priority: str = Field(default="1.0")
    assignee: Optional[str] = None
    current_column: str = Field(default="Not Started")
    board_id: int


class TicketCreate(TicketBase):
    created_by: Optional[str] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    changed_by: Optional[str] = None


class TicketMove(BaseModel):
    column: str
    moved_by: Optional[str] = None

    @validator("column")
    def validate_column(self, v):
        # Valid column names (case-insensitive)
        valid_columns = {
            "not started",
            "not_started",
            "in progress",
            "in_progress",
            "blocked",
            "ready for qc",
            "ready_for_qc",
            "done",
        }

        if v.lower() not in valid_columns:
            valid_list = ", ".join(sorted(valid_columns))
            raise ValueError(f'Invalid column name: "{v}". Must be one of: {valid_list}')

        return v


class TicketResponse(TicketBase):
    id: int
    created_at: datetime
    updated_at: datetime
    column_entered_at: datetime

    class Config:
        from_attributes = True
