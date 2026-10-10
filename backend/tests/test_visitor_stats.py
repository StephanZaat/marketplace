"""First-party visitor stats: recording rules and the admin aggregation."""
from datetime import date

from app.models.page_view import PageView
from app.traffic import device_of, source_of, visitor_hash

IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36"
GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"


def _pv(client, path, ua=IPHONE, **extra):
    return client.post("/api/stats/pv", json={"path": path, **extra}, headers={"User-Agent": ua})


class TestRecording:
    def test_records_anonymous_view(self, client, db):
        assert _pv(client, "/listings?q=bike#top").status_code == 204
        [v] = db.query(PageView).all()
        assert (v.path, v.device, v.os, len(v.visitor_hash)) == ("/listings", "mobile", "iOS", 16)

    def test_bots_and_admin_pages_are_ignored(self, client, db):
        _pv(client, "/", ua=GOOGLEBOT)
        _pv(client, "/admin/users")
        _pv(client, "/", ua="")
        assert db.query(PageView).count() == 0

    def test_source_from_referrer_and_utm(self, client, db):
        _pv(client, "/", referrer="https://www.facebook.com/somepost")
        _pv(client, "/", referrer="https://testserver/listings")  # own site (request host): not a source
        _pv(client, "/", referrer="https://google.com/", utm_source="Flyer")
        assert [v.source for v in db.query(PageView).order_by(PageView.id)] == ["facebook.com", None, "flyer"]


class TestHelpers:
    def test_device(self):
        assert device_of(IPHONE) == "mobile"
        assert device_of(DESKTOP) == "desktop"
        assert device_of("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)") == "tablet"

    def test_visitor_hash_is_daily(self):
        d1, d2 = date(2026, 10, 9), date(2026, 10, 10)
        assert visitor_hash("s", "1.2.3.4", "ua", d1) == visitor_hash("s", "1.2.3.4", "ua", d1)
        assert visitor_hash("s", "1.2.3.4", "ua", d1) != visitor_hash("s", "1.2.3.4", "ua", d2)

    def test_source_ignores_own_host_with_www(self):
        assert source_of("https://www.marketplace.aw/x", None, {"marketplace.aw"}) is None


class TestAdminTraffic:
    def test_aggregates(self, client, admin_client, auth_client, listing_payload):
        lid = auth_client.post("/api/listings", json=listing_payload).json()["id"]
        _pv(client, "/")
        _pv(client, f"/listings/{lid}")
        _pv(client, f"/listings/{lid}", ua=DESKTOP)
        d = admin_client.get("/api/admin/traffic?days=7").json()
        assert d["current"] == {"visitors": 2, "pageviews": 3, "pages_per_visitor": 1.5}
        assert len(d["series"]) == 7 and d["series"][-1]["pageviews"] == 3
        top = d["top_pages"][0]
        assert (top["path"], top["title"], top["pageviews"], top["visitors"]) == (f"/listings/{lid}", listing_payload["title"], 2, 2)
        assert {x["name"] for x in d["devices"]} == {"mobile", "desktop"}
        assert d["live"] == 2

    def test_requires_admin(self, auth_client):
        assert auth_client.get("/api/admin/traffic").status_code == 401
