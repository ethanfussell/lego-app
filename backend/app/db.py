# backend/app/db.py
import os
print("DATABASE_URL =", os.getenv("DATABASE_URL"))
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Load backend/.env no matter where uvicorn is run from
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"  # backend/.env
load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add it to backend/.env or export it in your shell."
    )

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