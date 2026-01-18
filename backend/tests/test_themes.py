def test_themes_list_returns_items(client):
    r = client.get("/themes")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)

    # If your seed DB has sets, at least one theme should exist
    if data:
        assert "theme" in data[0]
        assert "set_count" in data[0]


def test_theme_sets_pagination_and_total_count(client):
    # get a theme from /themes
    themes = client.get("/themes").json()
    if not themes:
        return

    theme = themes[0]["theme"]

    r = client.get(f"/themes/{theme}/sets?limit=5&offset=0")
    assert r.status_code == 200
    assert "X-Total-Count" in r.headers
    total = int(r.headers["X-Total-Count"])
    assert total > 0

    items = r.json()
    assert isinstance(items, list)
    assert len(items) <= 5
    if items:
        assert items[0]["theme"] == theme
        assert "set_num" in items[0]
        assert "name" in items[0]


def test_theme_not_found_returns_404(client):
    r = client.get("/themes/THIS_THEME_SHOULD_NOT_EXIST_12345/sets")
    assert r.status_code == 404
    assert r.json()["detail"] == "theme_not_found"

def test_theme_sets_sorting(client):
    themes = client.get("/themes").json()
    if not themes:
        return
    theme = themes[0]["theme"]

    r = client.get(f"/themes/{theme}/sets?limit=10&offset=0&sort=year&order=desc")
    assert r.status_code == 200