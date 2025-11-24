# tests/test_sets_sorting.py
import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.routers.sets as sets_router
import app.data.reviews as reviews_data

client = TestClient(app)


@pytest.fixture
def sample_sets():
    """
    Small, fake set list so we don't depend on the big Rebrickable cache.
    """
    return [
        {
            "set_num": "1001-1",
            "set_num_plain": "1001",
            "name": "Car One",
            "year": 2019,
            "pieces": 150,
            "theme": "City",
            "image_url": None,
        },
        {
            "set_num": "1002-1",
            "set_num_plain": "1002",
            "name": "Race Car",
            "year": 2021,
            "pieces": 300,
            "theme": "Speed",
            "image_url": None,
        },
        {
            "set_num": "1003-1",
            "set_num_plain": "1003",
            "name": "Space Station",
            "year": 2018,
            "pieces": 75,
            "theme": "Space",
            "image_url": None,
        },
    ]


@pytest.fixture
def sample_reviews(monkeypatch):
    """
    Fake reviews so rating sorting has deterministic averages:

    1001-1 → ratings [3, 4]  → avg 3.5
    1002-1 → ratings [5, 5]  → avg 5.0
    1003-1 → ratings [2]     → avg 2.0
    """
    reviews_data.REVIEWS = [
        {"set_num": "1001-1", "rating": 3},
        {"set_num": "1001-1", "rating": 4},
        {"set_num": "1002-1", "rating": 5},
        {"set_num": "1002-1", "rating": 5},
        {"set_num": "1003-1", "rating": 2},
    ]
    yield
    # optional: clean up if you want
    reviews_data.REVIEWS = []


def _use_sample_sets(monkeypatch, sample_sets):
    """
    Helper to make the /sets endpoint read from our sample_sets
    instead of the real sets_cache.json.
    """
    monkeypatch.setattr(sets_router, "load_cached_sets", lambda: sample_sets)


def test_sort_pieces_ascending(monkeypatch, sample_sets):
    _use_sample_sets(monkeypatch, sample_sets)

    resp = client.get("/sets", params={"sort": "pieces", "order": "asc", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    pieces = [s["pieces"] for s in data]
    assert pieces == sorted(pieces)


def test_sort_pieces_descending(monkeypatch, sample_sets):
    _use_sample_sets(monkeypatch, sample_sets)

    resp = client.get("/sets", params={"sort": "pieces", "order": "desc", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    pieces = [s["pieces"] for s in data]
    assert pieces == sorted(pieces, reverse=True)


def test_sort_year_ascending(monkeypatch, sample_sets):
    _use_sample_sets(monkeypatch, sample_sets)

    resp = client.get("/sets", params={"sort": "year", "order": "asc", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    years = [s["year"] for s in data]
    assert years == sorted(years)


def test_sort_year_descending(monkeypatch, sample_sets):
    _use_sample_sets(monkeypatch, sample_sets)

    resp = client.get("/sets", params={"sort": "year", "order": "desc", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    years = [s["year"] for s in data]
    assert years == sorted(years, reverse=True)


def test_sort_rating_descending(monkeypatch, sample_sets, sample_reviews):
    """
    With sample_reviews fixture, expected avg ratings:

    1002-1: 5.0
    1001-1: 3.5
    1003-1: 2.0

    So rating_desc should return sets in that order.
    """
    _use_sample_sets(monkeypatch, sample_sets)

    resp = client.get("/sets", params={"sort": "rating", "order": "desc", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    order = [s["set_num"] for s in data]

    assert order[:3] == ["1002-1", "1001-1", "1003-1"]


def test_sort_rating_ascending(monkeypatch, sample_sets, sample_reviews):
    """
    Reverse of the descending test: lowest avg first.
    """
    _use_sample_sets(monkeypatch, sample_sets)

    resp = client.get("/sets", params={"sort": "rating", "order": "asc", "limit": 50})
    assert resp.status_code == 200

    data = resp.json()
    order = [s["set_num"] for s in data]

    assert order[:3] == ["1003-1", "1001-1", "1002-1"]


def test_sort_relevance_with_query(monkeypatch, sample_sets, sample_reviews):
    """
    Query = 'car'

    Names:
      - 'Car One'   → name startswith 'car' (score 60) and contains (40) → 100
      - 'Race Car'  → contains 'car' (40)
      - 'Space Station' → doesn't match

    So we expect 'Car One' before 'Race Car'.
    """
    _use_sample_sets(monkeypatch, sample_sets)

    resp = client.get(
        "/sets",
        params={
            "q": "car",
            "sort": "relevance",
            "limit": 50,
        },
    )
    assert resp.status_code == 200

    data = resp.json()
    names = [s["name"] for s in data]

    # Only the two car sets should appear
    assert names[0] == "Car One"
    assert names[1] == "Race Car"
    assert all("car" in n.lower() for n in names)