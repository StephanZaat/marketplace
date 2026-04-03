"""Tests for /api/favorites endpoints."""
import pytest


# -- Helpers -------------------------------------------------------------------

@pytest.fixture()
def created_listing(auth_client, listing_payload):
    resp = auth_client.post("/api/listings", json=listing_payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# -- Add favorite --------------------------------------------------------------

class TestAddFavorite:
    def test_add_favorite(self, auth_client2, created_listing):
        resp = auth_client2.post(f"/api/favorites/{created_listing['id']}")
        assert resp.status_code == 201
        assert resp.json()["favorited"] is True

    def test_add_favorite_idempotent(self, auth_client2, created_listing):
        auth_client2.post(f"/api/favorites/{created_listing['id']}")
        resp = auth_client2.post(f"/api/favorites/{created_listing['id']}")
        # Second add is a no-op, not an error
        assert resp.status_code == 201

    def test_cannot_favorite_own_listing(self, auth_client, created_listing):
        resp = auth_client.post(f"/api/favorites/{created_listing['id']}")
        assert resp.status_code == 400

    def test_add_requires_auth(self, client, created_listing):
        resp = client.post(f"/api/favorites/{created_listing['id']}")
        assert resp.status_code == 401

    def test_add_nonexistent_listing_returns_404(self, auth_client2):
        resp = auth_client2.post("/api/favorites/zzzzzzzzzz")
        assert resp.status_code == 404


# -- Remove favorite -----------------------------------------------------------

class TestRemoveFavorite:
    def test_remove_favorite(self, auth_client2, created_listing):
        auth_client2.post(f"/api/favorites/{created_listing['id']}")
        resp = auth_client2.delete(f"/api/favorites/{created_listing['id']}")
        assert resp.status_code == 200
        assert resp.json()["favorited"] is False

    def test_remove_not_favorited_is_noop(self, auth_client2, created_listing):
        resp = auth_client2.delete(f"/api/favorites/{created_listing['id']}")
        assert resp.status_code == 200

    def test_remove_requires_auth(self, client, created_listing):
        resp = client.delete(f"/api/favorites/{created_listing['id']}")
        assert resp.status_code == 401


# -- List favorites ------------------------------------------------------------

class TestListFavorites:
    def test_list_empty(self, auth_client2):
        resp = auth_client2.get("/api/favorites")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_contains_favorited_listing(self, auth_client2, created_listing):
        auth_client2.post(f"/api/favorites/{created_listing['id']}")
        resp = auth_client2.get("/api/favorites")
        assert resp.status_code == 200
        ids = [l["id"] for l in resp.json()]
        assert created_listing["id"] in ids

    def test_list_excludes_removed_favorite(self, auth_client2, created_listing):
        auth_client2.post(f"/api/favorites/{created_listing['id']}")
        auth_client2.delete(f"/api/favorites/{created_listing['id']}")
        resp = auth_client2.get("/api/favorites")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_requires_auth(self, client):
        resp = client.get("/api/favorites")
        assert resp.status_code == 401
