import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import sets as sets_router

client = TestClient(app)


def _use_sets(monkeypatch, rows):
    """
    Patch router.load_cached_sets so /sets uses our fake data instead
    of the giant real cache.
    """
    monkeypatch.setattr(sets_router, "load_cached_sets", lambda: rows)


@pytest.fixture
def search_sets():
    """
    Small fake dataset to test search behavior + relevance ranking.
    """
    return [
        {
            "set_num": "1000-1",
            "set_num_plain": "1000",
            "name": "Castle",
            "year": 1984,
            "pieces": 100,
            "theme": "Castle",
            "image_url": None,
        },
        {
            "set_num": "1001-1",
            "set_num_plain": "1001",
            "name": "Small Castle",
            "year": 1986,
            "pieces": 150,
            "theme": "Castle",
            "image_url": None,
        },
        {
            "set_num": "1002-1",
            "set_num_plain": "1002",
            "name": "Space Cruiser",
            "year": 1982,
            "pieces": 200,
            "theme": "Space",
            "image_url": None,
        },
        {
            "set_num": "10305-1",
            "set_num_plain": "10305",
            "name": "Lion Knights' Castle",
            "year": 2022,
            "pieces": 4514,
            "theme": "Icons",
            "image_url": None,
        },
    ]


def test_search_by_name(monkeypatch, search_sets):
    """
    Searching by a word in the name should match the relevant sets.
    """
    _use_sets(monkeypatch, search_sets)

    resp = client.get("/sets", params={"q": "castle", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    names = [s["name"].lower() for s in data]

    # We expect all three castle-related sets to appear
    assert "castle" in names
    assert "small castle" in names
    assert "lion knights' castle" in names


def test_search_by_theme(monkeypatch, search_sets):
    """
    Searching by theme should also match.
    """
    _use_sets(monkeypatch, search_sets)

    resp = client.get("/sets", params={"q": "space", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Space Cruiser"


def test_search_by_full_set_num(monkeypatch, search_sets):
    """
    Searching by '10305-1' should match that set exactly.
    """
    _use_sets(monkeypatch, search_sets)

    resp = client.get("/sets", params={"q": "10305-1"})
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 1
    assert data[0]["set_num"] == "10305-1"
    assert data[0]["set_num_plain"] == "10305"


def test_search_by_plain_set_num(monkeypatch, search_sets):
    """
    Searching by '10305' (plain) should match the same set.
    """
    _use_sets(monkeypatch, search_sets)

    resp = client.get("/sets", params={"q": "10305"})
    assert resp.status_code == 200

    data = resp.json()
    assert len(data) == 1
    assert data[0]["set_num_plain"] == "10305"


def test_relevance_order_for_castle(monkeypatch, search_sets):
    """
    With q='castle' and default sort='relevance',
    'Castle' (exact word) should rank above 'Small Castle'.
    """
    _use_sets(monkeypatch, search_sets)

    resp = client.get("/sets", params={"q": "castle", "limit": 10})
    assert resp.status_code == 200

    data = resp.json()
    names = [s["name"] for s in data]

    # We expect "Castle" to appear before "Small Castle" because
    # name.startswith(q) scores higher than just name contains.
    assert names.index("Castle") < names.index("Small Castle")