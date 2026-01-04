"""unique users username

Revision ID: 2764c3ec52b9
Revises: 1a5fb03a5dc9
Create Date: 2026-01-01 11:20:49.478357

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2764c3ec52b9'
down_revision: Union[str, Sequence[str], None] = 'b7c1a8d9f2ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Unique (owner_id, system_key) only for system lists
    op.create_index(
        "uq_lists_owner_system_key_system_only",
        "lists",
        ["owner_id", "system_key"],
        unique=True,
        postgresql_where=op.text("is_system = true"),
    )

def downgrade():
    op.drop_index("uq_lists_owner_system_key_system_only", table_name="lists")