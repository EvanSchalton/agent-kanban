"""Add description field to boards table

Revision ID: add_board_description
Revises: 09495ffe4077
Create Date: 2025-08-10 23:16:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_board_description"
down_revision: Union[str, Sequence[str], None] = "09495ffe4077"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add description field to boards table"""
    # Check if column already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col["name"] for col in inspector.get_columns("boards")]

    if "description" not in columns:
        op.add_column("boards", sa.Column("description", sa.String(), nullable=True))


def downgrade() -> None:
    """Remove description field from boards table"""
    op.drop_column("boards", "description")
