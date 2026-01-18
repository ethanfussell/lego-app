def test_robots_txt(client):
    r = client.get("/robots.txt")
    assert r.status_code == 200
    assert "text/plain" in r.headers.get("content-type", "")
    assert "Sitemap:" in r.text

def test_sitemap_xml(client):
    r = client.get("/sitemap.xml")
    assert r.status_code == 200
    assert "application/xml" in r.headers.get("content-type", "")
    assert "<urlset" in r.text
    assert "<loc>" in r.text