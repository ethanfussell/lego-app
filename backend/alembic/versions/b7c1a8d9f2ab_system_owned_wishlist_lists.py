"""create system owned/wishlist lists and backfill from collections

Revision ID: b7c1a8d9f2ab
Revises: 3a9f0c2b7d1e
Create Date: 2026-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c1a8d9f2ab"
down_revision: Union[str, Sequence[str], None] = "3a9f0c2b7d1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Ensure one system list per (owner_id, system_key)
    # Partial unique index (only applies to system lists with a key)
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ux_lists_owner_system_key
        ON lists (owner_id, system_key)
        WHERE is_system IS TRUE AND system_key IS NOT NULL;
        """
    )

    # 2) Create system lists for users that don't have them.
    # Positions appended after max existing position per owner.
    op.execute(
        """
        WITH base AS (
          SELECT u.id AS owner_id,
                 COALESCE(MAX(l.position), -1) AS max_pos
          FROM users u
          LEFT JOIN lists l ON l.owner_id = u.id
          GROUP BY u.id
        )
        INSERT INTO lists (owner_id, title, description, is_public, position, is_system, system_key, created_at, updated_at)
        SELECT b.owner_id,
               'Owned' AS title,
               NULL AS description,
               FALSE AS is_public,
               b.max_pos + 1 AS position,
               TRUE AS is_system,
               'owned' AS system_key,
               NOW() AS created_at,
               NOW() AS updated_at
        FROM base b
        WHERE NOT EXISTS (
          SELECT 1 FROM lists l
          WHERE l.owner_id = b.owner_id AND l.is_system IS TRUE AND l.system_key = 'owned'
        );
        """
    )

    op.execute(
        """
        WITH base AS (
          SELECT u.id AS owner_id,
                 COALESCE(MAX(l.position), -1) AS max_pos
          FROM users u
          LEFT JOIN lists l ON l.owner_id = u.id
          GROUP BY u.id
        )
        INSERT INTO lists (owner_id, title, description, is_public, position, is_system, system_key, created_at, updated_at)
        SELECT b.owner_id,
               'Wishlist' AS title,
               NULL AS description,
               FALSE AS is_public,
               b.max_pos + 2 AS position,
               TRUE AS is_system,
               'wishlist' AS system_key,
               NOW() AS created_at,
               NOW() AS updated_at
        FROM base b
        WHERE NOT EXISTS (
          SELECT 1 FROM lists l
          WHERE l.owner_id = b.owner_id AND l.is_system IS TRUE AND l.system_key = 'wishlist'
        );
        """
    )

    # 3) Backfill list_items from collections into those system lists.
    # Deterministic item ordering (created_at, set_num) -> position.
    # Join sets to avoid FK issues if collections contains unknown set_num.
    op.execute(
        """
        INSERT INTO list_items (list_id, set_num, position, created_at)
        SELECT
          l.id AS list_id,
          c.set_num AS set_num,
          ROW_NUMBER() OVER (
            PARTITION BY l.id
            ORDER BY c.created_at ASC, c.set_num ASC
          ) - 1 AS position,
          c.created_at AS created_at
        FROM collections c
        JOIN lists l
          ON l.owner_id = c.user_id
         AND l.is_system IS TRUE
         AND l.system_key = c.type
        JOIN sets s
          ON s.set_num = c.set_num
        WHERE c.type IN ('owned','wishlist')
        ON CONFLICT (list_id, set_num) DO NOTHING;
        """
    )


def downgrade() -> None:
    # Reverse backfill (only items that belong to system owned/wishlist lists)
    op.execute(
        """
        DELETE FROM list_items li
        USING lists l
        WHERE li.list_id = l.id
          AND l.is_system IS TRUE
          AND l.system_key IN ('owned','wishlist');
        """
    )

    # Delete system lists
    op.execute(
        """
        DELETE FROM lists
        WHERE is_system IS TRUE AND system_key IN ('owned','wishlist');
        """
    )

    op.execute("DROP INDEX IF EXISTS ux_lists_owner_system_key;")