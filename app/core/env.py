# app/core/env.py
import os
from pathlib import Path
from dotenv import load_dotenv

# Find .env at the project root (one level above /app)
ROOT_DIR = Path(__file__).resolve().parents[2]
DOTENV_PATH = ROOT_DIR / ".env"

if DOTENV_PATH.exists():
    load_dotenv(DOTENV_PATH)
else:
    print("⚠️  Warning: .env not found at", DOTENV_PATH)

# Optional helper
def get_env(key: str, default=None):
    """Safe helper to fetch environment variables."""
    return os.getenv(key, default)