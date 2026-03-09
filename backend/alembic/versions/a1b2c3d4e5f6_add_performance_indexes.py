"""add_performance_indexes

Revision ID: a1b2c3d4e5f6
Revises: d4bf0f0bf86f
Create Date: 2026-03-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'd4bf0f0bf86f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("idx_reviews_user_set_num", "reviews", ["user_id", "set_num"])
    op.create_index("idx_reviews_created_at", "reviews", ["created_at"])
    op.create_index("idx_lists_owner_system_key", "lists", ["owner_id", "is_system", "system_key"])


def downgrade() -> None:
    op.drop_index("idx_lists_owner_system_key", table_name="lists")
    op.drop_index("idx_reviews_created_at", table_name="reviews")
    op.drop_index("idx_reviews_user_set_num", table_name="reviews")
