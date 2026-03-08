"""add_set_tag

Revision ID: d4bf0f0bf86f
Revises: 164d23cae8f7
Create Date: 2026-03-07 21:22:50.658549

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4bf0f0bf86f'
down_revision: Union[str, Sequence[str], None] = '164d23cae8f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sets', sa.Column('set_tag', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sets', 'set_tag')
