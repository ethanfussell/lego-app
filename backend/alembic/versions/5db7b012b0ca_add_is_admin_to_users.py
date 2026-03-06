"""add_is_admin_to_users

Revision ID: 5db7b012b0ca
Revises: 94d10b2321eb
Create Date: 2026-03-05 16:47:45.463886

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5db7b012b0ca'
down_revision: Union[str, Sequence[str], None] = '94d10b2321eb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'is_admin')
