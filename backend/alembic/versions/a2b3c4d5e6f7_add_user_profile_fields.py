"""add user profile fields (merge heads)

Revision ID: a2b3c4d5e6f7
Revises: a1b2c3d4e5f6, fbe84f4db00a
Create Date: 2026-03-14 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7"
down_revision: tuple[str, str] = ("a1b2c3d4e5f6", "fbe84f4db00a")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("bio", sa.String(500), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("location", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "location")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "bio")
    op.drop_column("users", "display_name")
