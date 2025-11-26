import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import sets as sets_router
from app.data import reviews as reviews_data

client = TestClient(app)


def _use_sets(monkeypatch, rows):
    """
    IMPORTANT: patch the router's load_cached_sets, not the data module.
    """
    monkeypatch.setattr(sets_router, "load_cached_sets", lambda: rows)


@pytest.fixture
def rated_sets():
    """
    Two sets, so we can test average ratings and sorting.
    """
    return [
        {
            "set_num": "1000-1",
            "set_num_plain": "1000",
            "name": "Set A",
            "year": 2020,
            "pieces": 100,
            "theme": "Test",
            "image_url": None,
        },
        {
            "set_num": "1001-1",
            "set_num_plain": "1001",
            "name": "Set B",
            "year": 2020,
            "pieces": 200,
            "theme": "Test",
            "image_url": None,
        },
    ]


@pytest.fixture
def reviews_for_ratings():
    """
    Reviews for the two sets:

    - Set A: ratings 5 and 3 → avg = 4.0, count = 2
    - Set B: ratings 4, 4, 4 → avg = 4.0, count = 3
    """
    return [
        {"set_num": "1000-1", "rating": 5},
        {"set_num": "1000-1", "rating": 3},
        {"set_num": "1001-1", "rating": 4},
        {"set_num": "1001-1", "rating": 4},
        {"set_num": "1001-1", "rating": 4},
    ]


def test_rating_fields_in_list(monkeypatch, rated_sets, reviews_for_ratings):
    """
    /sets should include rating_avg and rating_count for each set.
    """
    _use_sets(monkeypatch, rated_sets)
    monkeypatch.setattr(reviews_data, "REVIEWS", reviews_for_ratings)

    resp = client.get("/sets", params={"limit": 10})
    assert resp.status_code == 200

    data = resp.json()
    # Convert into dict keyed by set_num for easier checks
    by_num = {s["set_num"]: s for s in data}

    assert "1000-1" in by_num
    assert "1001-1" in by_num

    a = by_num["1000-1"]
    b = by_num["1001-1"]

    assert a["rating_avg"] == 4.0
    assert a["rating_count"] == 2

    assert b["rating_avg"] == 4.0
    assert b["rating_count"] == 3


def test_sort_by_rating_desc(monkeypatch, rated_sets, reviews_for_ratings):
    """
    Sort by rating desc should put higher-rated (or same rating, more ratings)
    first. In our simple logic, we sort by (avg, count).
    So Set B (avg 4.0, count 3) should come before Set A (avg 4.0, count 2).
    """
    _use_sets(monkeypatch, rated_sets)
    monkeypatch.setattr(reviews_data, "REVIEWS", reviews_for_ratings)

    resp = client.get("/sets", params={"sort": "rating", "order": "desc", "limit": 10})
    assert resp.status_code == 200

    data = resp.json()
    names = [s["name"] for s in data]

    # Expect Set B before Set A
    assert names.index("Set B") < names.index("Set A")