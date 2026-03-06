"""add set pipeline fields (ip, first_seen_at, retirement)

Revision ID: c4e5f6a7b890
Revises: b3a1d2e4f567
Create Date: 2026-03-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4e5f6a7b890"
down_revision: Union[str, None] = "b3a1d2e4f567"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sets", sa.Column("ip", sa.String(), nullable=True))
    op.add_column("sets", sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False))
    op.add_column("sets", sa.Column("retirement_status", sa.String(), nullable=True))
    op.add_column("sets", sa.Column("retirement_date", sa.String(), nullable=True))

    op.create_index("ix_sets_ip", "sets", ["ip"])
    op.create_index("ix_sets_first_seen_at", "sets", ["first_seen_at"])
    op.create_index("ix_sets_retirement_status", "sets", ["retirement_status"])


def downgrade() -> None:
    op.drop_index("ix_sets_retirement_status", table_name="sets")
    op.drop_index("ix_sets_first_seen_at", table_name="sets")
    op.drop_index("ix_sets_ip", table_name="sets")

    op.drop_column("sets", "retirement_date")
    op.drop_column("sets", "retirement_status")
    op.drop_column("sets", "first_seen_at")
    op.drop_column("sets", "ip")
