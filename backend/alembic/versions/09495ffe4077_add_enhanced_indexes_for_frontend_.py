"""Add enhanced indexes for frontend performance

Revision ID: 09495ffe4077
Revises: b3b80e2dd026
Create Date: 2025-08-10 22:53:14.293291

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "09495ffe4077"
down_revision: Union[str, Sequence[str], None] = "b3b80e2dd026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Enhanced indexes for frontend performance - recreate optimized versions

    # Primary board query optimization
    op.create_index(
        "idx_tickets_board_column_priority_v2",
        "tickets",
        ["board_id", "current_column", "priority"],
    )
    op.create_index("idx_tickets_board_created_v2", "tickets", ["board_id", "created_at"])

    # Drag-and-drop optimization
    op.create_index(
        "idx_tickets_column_entered_v2", "tickets", ["current_column", "column_entered_at"]
    )
    op.create_index(
        "idx_tickets_id_column_v2", "tickets", ["id", "current_column"]
    )  # For quick status updates

    # Statistics calculation optimization
    op.create_index(
        "idx_tickets_board_updated_created_v2", "tickets", ["board_id", "updated_at", "created_at"]
    )
    op.create_index("idx_tickets_assignee_created_v2", "tickets", ["assignee", "created_at"])

    # History tracking optimization
    op.create_index("idx_history_ticket_changed_v2", "ticket_history", ["ticket_id", "changed_at"])
    op.create_index("idx_history_field_changed_v2", "ticket_history", ["field_name", "changed_at"])

    # Board data caching optimization
    op.create_index("idx_boards_name_updated_v2", "boards", ["name", "updated_at"])

    # Comment performance for ticket details
    op.create_index(
        "idx_comments_ticket_author_v2", "comments", ["ticket_id", "author", "created_at"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop enhanced indexes
    op.drop_index("idx_tickets_board_column_priority_v2")
    op.drop_index("idx_tickets_board_created_v2")
    op.drop_index("idx_tickets_column_entered_v2")
    op.drop_index("idx_tickets_id_column_v2")
    op.drop_index("idx_tickets_board_updated_created_v2")
    op.drop_index("idx_tickets_assignee_created_v2")
    op.drop_index("idx_history_ticket_changed_v2")
    op.drop_index("idx_history_field_changed_v2")
    op.drop_index("idx_boards_name_updated_v2")
    op.drop_index("idx_comments_ticket_author_v2")
