"""add position to list_items and backfill

Revision ID: 3a9f0c2b7d1e
Revises: 00d144dec059
Create Date: 2026-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3a9f0c2b7d1e"
down_revision: Union[str, Sequence[str], None] = "00d144dec059"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Add nullable column first (safe for existing rows)
    op.add_column("list_items", sa.Column("position", sa.Integer(), nullable=True))

    # 2) Backfill deterministic position per list_id
    op.execute(
        """
        WITH ranked AS (
            SELECT
                list_id,
                set_num,
                ROW_NUMBER() OVER (
                    PARTITION BY list_id
                    ORDER BY created_at ASC, set_num ASC
                ) - 1 AS new_pos
            FROM list_items
        )
        UPDATE list_items li
        SET position = ranked.new_pos
        FROM ranked
        WHERE li.list_id = ranked.list_id AND li.set_num = ranked.set_num;
        """
    )

    # 3) Helpful index for ordering queries
    op.create_index(
        "idx_list_items_list_id_position",
        "list_items",
        ["list_id", "position"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_list_items_list_id_position", table_name="list_items")
    op.drop_column("list_items", "position")