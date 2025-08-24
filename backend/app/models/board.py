import json
from datetime import datetime
from typing import List, Optional

from sqlmodel import Field, Relationship, SQLModel


class Board(SQLModel, table=True):
    __tablename__ = "boards"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = Field(default=None)
    columns: str = Field(
        default='["Not Started", "In Progress", "Blocked", "Ready for QC", "Done"]'
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    tickets: List["Ticket"] = Relationship(back_populates="board")

    def get_columns_list(self) -> List[str]:
        return json.loads(self.columns)

    def set_columns_list(self, columns: List[str]):
        self.columns = json.dumps(columns)
