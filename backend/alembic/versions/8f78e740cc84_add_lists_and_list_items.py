"""add lists and list_items

Revision ID: 8f78e740cc84
Revises: 5c236543ea7a
Create Date: 2025-12-28 19:08:22.661000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f78e740cc84"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
