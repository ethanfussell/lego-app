# tests/test_sets.py

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_list_sets_basic():
    """Basic sanity check that /sets returns a list."""
    resp = client.get("/sets")
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)


def test_list_sets_search_and_sort_pieces_desc():
    """
    /sets with a query + sort by pieces desc.
    If there aren't enough sets, we skip the deeper assertions.
    """
    resp = client.get("/sets", params={"q": "castle", "sort": "pieces", "order": "desc", "limit": 20})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)

    if len(data) < 2:
        pytest.skip("Not enough matching sets in cache to assert sorting.")

    pieces = [s.get("pieces") or 0 for s in data]
    assert pieces == sorted(pieces, reverse=True)


def test_list_sets_pagination_limit_and_header():
    """
    /sets should respect limit and send X-Total-Count header.
    """
    resp = client.get("/sets", params={"q": "city", "page": 1, "limit": 5})
    assert resp.status_code == 200

    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 5

    total = resp.headers.get("X-Total-Count")
    # header should exist, even if zero
    assert total is not None
    # should be an integer string
    int(total)


def test_list_sets_pagination_high_page():
    """
    Asking for a very high page should not crash and should still return 200.
    """
    resp = client.get("/sets", params={"q": "city", "page": 50, "limit": 10})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_get_set_detail_round_trip():
    """
    Get first item from /sets, then fetch /sets/{set_num} and compare.
    If no sets in cache, skip.
    """
    list_resp = client.get("/sets", params={"limit": 1})
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert isinstance(items, list)

    if not items:
        pytest.skip("No sets in cache to test detail endpoint.")

    first = items[0]
    set_num = first.get("set_num")
    assert set_num

    detail_resp = client.get(f"/sets/{set_num}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()

    assert detail["set_num"] == set_num
    assert detail["name"] == first["name"]


def test_get_set_not_found():
    """Unknown set_num should return 404."""
    resp = client.get("/sets/this-does-not-exist-999999")
    assert resp.status_code == 404


def test_sets_suggest_basic():
    """
    /sets/suggest should return a small list of suggestions.
    If the implementation uses relevance, we only assert shapes, not exact values.
    """
    resp = client.get("/sets/suggest", params={"q": "star", "limit": 5})
    # If you haven't added the /sets/suggest endpoint yet, this will be 404.
    # In that case, comment this test out or add the endpoint.
    if resp.status_code == 404:
        pytest.skip("Suggest endpoint not implemented yet.")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 5

    # basic shape check
    if data:
        s = data[0]
        assert "name" in s
        assert "set_num" in s