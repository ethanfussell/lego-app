# tests/test_sets_pagination.py
import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.routers.sets as sets_router

client = TestClient(app)


@pytest.fixture
def many_sets():
    """
    Create 50 fake sets so we can test paging.

    set_num: 1000-1 .. 1049-1
    pieces = i
    year = 2000 + (i % 20)
    """
    rows = []
    for i in range(50):
        rows.append({
            "set_num": f"{1000+i}-1",
            "set_num_plain": f"{1000+i}",
            "name": f"Set {i}",
            "year": 2000 + (i % 20),
            "pieces": i,
            "theme": "Test",
            "image_url": None,
        })
    return rows


def _use_sets(monkeypatch, many_sets):
    """
    Patch load_cached_sets() so the endpoint uses our fake dataset.
    """
    monkeypatch.setattr(sets_router, "load_cached_sets", lambda: many_sets)


def test_page_size(monkeypatch, many_sets):
    _use_sets(monkeypatch, many_sets)

    # Explicitly sort by pieces so ordering is numeric and predictable
    resp = client.get("/sets", params={"limit": 20, "page": 1, "sort": "pieces", "order": "asc"})
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 20  # exactly 20 items
    # sanity check: first/last of page 1
    assert data[0]["name"] == "Set 0"
    assert data[-1]["name"] == "Set 19"


def test_second_page(monkeypatch, many_sets):
    _use_sets(monkeypatch, many_sets)

    resp = client.get("/sets", params={"limit": 20, "page": 2, "sort": "pieces", "order": "asc"})
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 20  # still 20 items

    # now that we're sorting by pieces asc, this is deterministic:
    # page 1: Set 0..19, page 2: Set 20..39
    assert data[0]["name"] == "Set 20"
    assert data[-1]["name"] == "Set 39"


def test_last_page(monkeypatch, many_sets):
    _use_sets(monkeypatch, many_sets)

    resp = client.get("/sets", params={"limit": 20, "page": 3, "sort": "pieces", "order": "asc"})
    assert resp.status_code == 200

    data = resp.json()
    # 50 total → 20 + 20 + 10
    assert len(data) == 10

    # last page should have Set 40..49
    assert data[0]["name"] == "Set 40"
    assert data[-1]["name"] == "Set 49"


def test_out_of_range_page(monkeypatch, many_sets):
    _use_sets(monkeypatch, many_sets)

    resp = client.get("/sets", params={"limit": 20, "page": 99, "sort": "pieces", "order": "asc"})
    assert resp.status_code == 200

    data = resp.json()
    assert data == []  # out-of-range returns empty list


def test_total_count_header(monkeypatch, many_sets):
    _use_sets(monkeypatch, many_sets)

    resp = client.get("/sets", params={"limit": 20, "page": 1, "sort": "pieces", "order": "asc"})
    assert resp.status_code == 200

    assert resp.headers.get("X-Total-Count") == "50"