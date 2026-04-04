"""Tests for /api/alerts endpoints: category alert subscriptions."""


class TestGetCategoryAlerts:
    def test_get_empty_alerts(self, auth_client):
        resp = auth_client.get("/api/alerts/categories")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_requires_auth(self, client):
        resp = client.get("/api/alerts/categories")
        assert resp.status_code == 401


class TestSetCategoryAlerts:
    def test_set_alerts(self, auth_client, category):
        resp = auth_client.put("/api/alerts/categories", json=[category.public_id])
        assert resp.status_code == 200
        assert resp.json() == [category.public_id]

    def test_set_alerts_returns_in_get(self, auth_client, category):
        auth_client.put("/api/alerts/categories", json=[category.public_id])
        resp = auth_client.get("/api/alerts/categories")
        assert resp.status_code == 200
        assert category.public_id in resp.json()

    def test_set_empty_clears_alerts(self, auth_client, category):
        auth_client.put("/api/alerts/categories", json=[category.public_id])
        resp = auth_client.put("/api/alerts/categories", json=[])
        assert resp.status_code == 200
        assert resp.json() == []

        resp = auth_client.get("/api/alerts/categories")
        assert resp.json() == []

    def test_set_ignores_invalid_category(self, auth_client):
        resp = auth_client.put("/api/alerts/categories", json=["nonexistent"])
        assert resp.status_code == 200
        assert resp.json() == []

    def test_set_requires_auth(self, client, category):
        resp = client.put("/api/alerts/categories", json=[category.public_id])
        assert resp.status_code == 401

    def test_set_replaces_previous(self, auth_client, db, category):
        """Setting new alerts replaces old ones, not appends."""
        from app.models.category import Category
        from app.utils import generate_public_id
        cat2 = Category(name="Cars", slug="cars-alerts-test", icon="Car", sort_order=1, public_id=generate_public_id())
        db.add(cat2)
        db.commit()
        db.refresh(cat2)

        auth_client.put("/api/alerts/categories", json=[category.public_id])
        resp = auth_client.put("/api/alerts/categories", json=[cat2.public_id])
        assert resp.status_code == 200
        assert resp.json() == [cat2.public_id]
