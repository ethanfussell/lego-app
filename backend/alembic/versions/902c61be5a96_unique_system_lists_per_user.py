"""unique system lists per user

Revision ID: 902c61be5a96
Revises: 2764c3ec52b9
Create Date: 2026-01-01 11:29:43.541642

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '902c61be5a96'
down_revision: Union[str, Sequence[str], None] = '2764c3ec52b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
