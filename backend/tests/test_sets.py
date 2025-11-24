# tests/test_sets.py
from pathlib import Path
import sys

# --- Make sure Python can find the `app` package ---
ROOT_DIR = Path(__file__).resolve().parents[1]  # /.../lego-app/backend
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_search_sets_basic():
    """
    Simple smoke test:
    - /sets endpoint responds 200
    - returns a list
    """
    resp = client.get("/sets", params={"q": "castle", "limit": 5})
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    # allow 0 results (depending on your cache), just check shape:
    if data:
        assert "set_num" in data[0]
        assert "name" in data[0]