"""Add database indexes for performance optimization

Revision ID: b3b80e2dd026
Revises: f0a59d52113c
Create Date: 2025-08-10 22:42:33.963315

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3b80e2dd026"
down_revision: Union[str, Sequence[str], None] = "f0a59d52113c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Performance indexes for query optimization

    # Tickets table indexes
    op.create_index("idx_tickets_board_column", "tickets", ["board_id", "current_column"])
    op.create_index("idx_tickets_assignee_column", "tickets", ["assignee", "current_column"])
    op.create_index("idx_tickets_priority_board", "tickets", ["priority", "board_id"])
    op.create_index("idx_tickets_created_at", "tickets", ["created_at"])
    op.create_index("idx_tickets_updated_at", "tickets", ["updated_at"])
    op.create_index("idx_tickets_column_entered_at", "tickets", ["column_entered_at"])

    # Ticket History indexes for analytics and history queries
    op.create_index(
        "idx_ticket_history_ticket_field", "ticket_history", ["ticket_id", "field_name"]
    )
    op.create_index("idx_ticket_history_changed_at", "ticket_history", ["changed_at"])
    op.create_index("idx_ticket_history_changed_by", "ticket_history", ["changed_by"])
    op.create_index("idx_ticket_history_field_value", "ticket_history", ["field_name", "new_value"])

    # Comments table indexes
    op.create_index("idx_comments_ticket_created", "comments", ["ticket_id", "created_at"])
    op.create_index("idx_comments_author", "comments", ["author"])

    # Boards table indexes
    op.create_index("idx_boards_created_at", "boards", ["created_at"])
    op.create_index("idx_boards_updated_at", "boards", ["updated_at"])

    # Composite indexes for common query patterns
    op.create_index(
        "idx_tickets_board_status_priority", "tickets", ["board_id", "current_column", "priority"]
    )
    op.create_index("idx_tickets_assignee_updated", "tickets", ["assignee", "updated_at"])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop all created indexes
    op.drop_index("idx_tickets_board_column")
    op.drop_index("idx_tickets_assignee_column")
    op.drop_index("idx_tickets_priority_board")
    op.drop_index("idx_tickets_created_at")
    op.drop_index("idx_tickets_updated_at")
    op.drop_index("idx_tickets_column_entered_at")

    op.drop_index("idx_ticket_history_ticket_field")
    op.drop_index("idx_ticket_history_changed_at")
    op.drop_index("idx_ticket_history_changed_by")
    op.drop_index("idx_ticket_history_field_value")

    op.drop_index("idx_comments_ticket_created")
    op.drop_index("idx_comments_author")

    op.drop_index("idx_boards_created_at")
    op.drop_index("idx_boards_updated_at")

    op.drop_index("idx_tickets_board_status_priority")
    op.drop_index("idx_tickets_assignee_updated")
