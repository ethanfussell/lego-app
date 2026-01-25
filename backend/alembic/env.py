# backend/alembic/env.py
from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool
from dotenv import load_dotenv

# Alembic Config object (reads alembic.ini)
config = context.config

# Logging config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# -----------------------------------------------------------------------------
# Ensure we can import "app.*" when running `alembic` from backend/
# backend/
#   alembic/
#   app/
#   .env (local only)
# -----------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parents[1]  # .../backend
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load backend/.env if it exists (LOCAL DEV), but don't require it (Render/prod)
env_path = BACKEND_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)

# Prefer environment variable DATABASE_URL (Render), fallback to .env (local)
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set (env var or backend/.env).")

# Override whatever is in alembic.ini (fixes placeholder issue)
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Import your models so Base.metadata is populated
from app.db import Base  # noqa: E402
import app.models  # noqa: F401, E402  (ensure models are registered)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    section = config.get_section(config.config_ini_section) or {}

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()