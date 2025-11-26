import json
from pathlib import Path

from app.data import sets as sets_data


def test_load_cached_sets_missing_file(monkeypatch, tmp_path):
    """
    When the cache file does not exist, load_cached_sets() should return [].
    """
    fake_cache = tmp_path / "sets_cache.json"
    # Make sure it doesn't exist
    if fake_cache.exists():
        fake_cache.unlink()

    monkeypatch.setattr(sets_data, "CACHE_FILE", fake_cache)

    rows = sets_data.load_cached_sets()
    assert rows == []
    assert sets_data.cache_count() == 0


def test_load_cached_sets_valid(monkeypatch, tmp_path):
    """
    With a valid JSON cache, load_cached_sets() should return the parsed list
    and cache_count() should reflect its length.
    """
    fake_cache = tmp_path / "sets_cache.json"
    sample_rows = [
        {"set_num": "1000-1", "name": "Test Set 1"},
        {"set_num": "1001-1", "name": "Test Set 2"},
    ]
    fake_cache.write_text(json.dumps(sample_rows))

    monkeypatch.setattr(sets_data, "CACHE_FILE", fake_cache)

    rows = sets_data.load_cached_sets()
    assert len(rows) == 2
    assert rows[0]["set_num"] == "1000-1"
    assert sets_data.cache_count() == 2


def test_load_cached_sets_corrupted(monkeypatch, tmp_path, capsys):
    """
    If the cache file contains invalid JSON, load_cached_sets() should
    print a warning and return [].
    """
    fake_cache = tmp_path / "sets_cache.json"
    fake_cache.write_text("{not valid json")

    monkeypatch.setattr(sets_data, "CACHE_FILE", fake_cache)

    rows = sets_data.load_cached_sets()
    captured = capsys.readouterr()

    assert rows == []
    # We don't assert exact text, just that a warning was printed
    assert "Cache corrupted" in captured.out
    assert sets_data.cache_count() == 0