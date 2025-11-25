import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.data import sets as sets_data
from app.data import reviews as reviews_data

client = TestClient(app)


def _use_sets(monkeypatch, rows):
    monkeypatch.setattr(sets_data, "load_cached_sets", lambda: rows)


@pytest.fixture
def one_set():
    return [
        {
            "set_num": "10305-1",
            "set_num_plain": "10305",
            "name": "Lion Knights' Castle",
            "year": 2022,
            "pieces": 4514,
            "theme": "Icons",
            "image_url": None,
        }
    ]


@pytest.fixture
def reviews_for_one():
    return [
        {"set_num": "10305-1", "rating": 5},
        {"set_num": "10305-1", "rating": 4},
    ]


def test_get_set_by_full_number(monkeypatch, one_set, reviews_for_one):
    _use_sets(monkeypatch, one_set)
    reviews_data.REVIEWS = reviews_for_one

    resp = client.get("/sets/10305-1")
    assert resp.status_code == 200

    data = resp.json()
    assert data["set_num"] == "10305-1"
    assert data["name"] == "Lion Knights' Castle"
    assert data["rating_avg"] == 4.5
    assert data["rating_count"] == 2


def test_get_set_by_plain_number(monkeypatch, one_set, reviews_for_one):
    _use_sets(monkeypatch, one_set)
    reviews_data.REVIEWS = reviews_for_one

    resp = client.get("/sets/10305")
    assert resp.status_code == 200

    data = resp.json()
    assert data["set_num_plain"] == "10305"
    assert data["name"] == "Lion Knights' Castle"


def test_get_set_not_found(monkeypatch, one_set):
    _use_sets(monkeypatch, one_set)

    resp = client.get("/sets/99999")
    assert resp.status_code == 404

    data = resp.json()
    assert data["detail"] == "Set not found"