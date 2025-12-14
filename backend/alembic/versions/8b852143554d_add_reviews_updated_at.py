"""add reviews.updated_at

Revision ID: 8b852143554d
Revises: 42beccf00f0d
Create Date: 2025-12-13 16:50:40.254107

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b852143554d'
down_revision: Union[str, Sequence[str], None] = '42beccf00f0d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reviews",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("reviews", "updated_at")
