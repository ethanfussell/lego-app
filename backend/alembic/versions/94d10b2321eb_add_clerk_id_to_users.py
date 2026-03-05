"""add_clerk_id_to_users

Revision ID: 94d10b2321eb
Revises: c4e5f6a7b890
Create Date: 2026-03-05 14:10:18.257123

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '94d10b2321eb'
down_revision: Union[str, Sequence[str], None] = 'c4e5f6a7b890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('clerk_id', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_clerk_id'), 'users', ['clerk_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_users_clerk_id'), table_name='users')
    op.drop_column('users', 'clerk_id')
