"""add followers table

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-14 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "followers",
        sa.Column("follower_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("following_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("follower_id != following_id", name="followers_no_self_follow"),
    )
    op.create_index("idx_followers_follower_id", "followers", ["follower_id"])
    op.create_index("idx_followers_following_id", "followers", ["following_id"])


def downgrade() -> None:
    op.drop_index("idx_followers_following_id", table_name="followers")
    op.drop_index("idx_followers_follower_id", table_name="followers")
    op.drop_table("followers")
