# backend/app/db.py
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Load backend/.env no matter where uvicorn is run from (local dev)
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"  # backend/.env
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to backend/.env or export it in your shell."
    )


def normalize_db_url(u: str) -> str:
    """
    Force SQLAlchemy to use psycopg v3.

    - `postgres://...`  -> `postgresql+psycopg://...`
    - `postgresql://...` -> `postgresql+psycopg://...`
    - `postgresql+psycopg2://...` -> `postgresql+psycopg://...`
    """
    url = u.strip()

    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]

    if url.startswith("postgresql+psycopg2://"):
        url = "postgresql+psycopg://" + url[len("postgresql+psycopg2://") :]

    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]

    return url


DATABASE_URL = normalize_db_url(DATABASE_URL)

# Keep process env consistent for anything else that reads it later
os.environ["DATABASE_URL"] = DATABASE_URL

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()