from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class BulkMoveRequest(BaseModel):
    """Request model for bulk ticket moves"""

    ticket_ids: List[int] = Field(..., min_items=1, description="List of ticket IDs to move")
    target_column: str = Field(..., description="Target column to move tickets to")

    class Config:
        json_schema_extra = {
            "example": {
                "ticket_ids": [1, 2, 3],
                "target_column": "in_progress",
            }
        }


class BulkMoveResult(BaseModel):
    """Individual ticket move result"""

    ticket_id: int
    success: bool
    error: Optional[str] = None
    old_column: Optional[str] = None
    new_column: Optional[str] = None


class BulkMoveResponse(BaseModel):
    """Response model for bulk ticket moves"""

    total_requested: int
    successful_moves: int
    failed_moves: int
    results: List[BulkMoveResult]
    execution_time_ms: float

    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        return (
            (self.successful_moves / self.total_requested) * 100 if self.total_requested > 0 else 0
        )


class BulkUpdatePriorityRequest(BaseModel):
    """Request model for bulk priority updates"""

    updates: List[Dict[str, Any]] = Field(
        ..., min_items=1, description="List of ticket ID and priority pairs"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "updates": [
                    {"ticket_id": 1, "priority": "1.1"},
                    {"ticket_id": 2, "priority": "2.0"},
                ]
            }
        }


class BulkAssignRequest(BaseModel):
    """Request model for bulk assignee updates"""

    ticket_ids: List[int] = Field(..., min_items=1, description="List of ticket IDs to assign")
    assignee: Optional[str] = Field(None, description="Assignee name (null to unassign)")

    class Config:
        json_schema_extra = {
            "example": {
                "ticket_ids": [1, 2],
                "assignee": "john.doe",
            }
        }


class BulkOperationResponse(BaseModel):
    """Generic bulk operation response"""

    total_requested: int
    successful_operations: int
    failed_operations: int
    results: List[Dict[str, Any]]
    execution_time_ms: float
    operation_type: str
