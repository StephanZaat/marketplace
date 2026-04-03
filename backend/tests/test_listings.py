"""Tests for /api/listings endpoints."""
import pytest
from app.models.listing import Listing, ListingStatus


# -- Helpers -------------------------------------------------------------------

@pytest.fixture()
def created_listing(auth_client, listing_payload):
    """Creates a listing as Alice and returns the response JSON."""
    resp = auth_client.post("/api/listings", json=listing_payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# -- List ----------------------------------------------------------------------

class TestListListings:
    def test_empty_list(self, client):
        resp = client.get("/api/listings")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_active_listings(self, client, created_listing):
        resp = client.get("/api/listings")
        assert resp.status_code == 200
        ids = [l["id"] for l in resp.json()]
        assert created_listing["id"] in ids

    def test_filter_by_category(self, client, created_listing, category):
        resp = client.get("/api/listings", params={"category": category.slug})
        assert resp.status_code == 200
        assert any(l["id"] == created_listing["id"] for l in resp.json())

    def test_filter_by_unknown_category_is_ignored(self, client, created_listing):
        resp = client.get("/api/listings", params={"category": "nonexistent-slug"})
        assert resp.status_code == 200
        assert any(l["id"] == created_listing["id"] for l in resp.json())

    def test_search_by_title(self, client, created_listing):
        resp = client.get("/api/listings", params={"q": "iPhone"})
        assert resp.status_code == 200
        assert any(l["id"] == created_listing["id"] for l in resp.json())

    def test_search_no_match_returns_empty(self, client, created_listing):
        resp = client.get("/api/listings", params={"q": "xyznotfound"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_filter_by_min_price(self, client, created_listing):
        resp = client.get("/api/listings", params={"min_price": 500})
        assert resp.status_code == 200
        assert not any(l["id"] == created_listing["id"] for l in resp.json())

    def test_filter_by_max_price(self, client, created_listing):
        resp = client.get("/api/listings", params={"max_price": 500})
        assert resp.status_code == 200
        assert any(l["id"] == created_listing["id"] for l in resp.json())

    def test_inactive_listing_not_in_public_list(self, auth_client, created_listing):
        auth_client.delete(f"/api/listings/{created_listing['id']}")
        resp = auth_client.get("/api/listings")
        assert not any(l["id"] == created_listing["id"] for l in resp.json())


# -- Get detail ----------------------------------------------------------------

class TestGetListing:
    def test_get_existing_listing(self, client, created_listing):
        resp = client.get(f"/api/listings/{created_listing['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == created_listing["id"]
        assert data["title"] == created_listing["title"]
        assert "seller" in data
        assert "category" in data

    def test_get_nonexistent_listing_returns_404(self, client):
        resp = client.get("/api/listings/zzzzzzzzzz")
        assert resp.status_code == 404

    def test_get_increments_view_count(self, client, created_listing):
        lid = created_listing["id"]
        before = client.get(f"/api/listings/{lid}").json()["view_count"]
        client.get(f"/api/listings/{lid}")
        after = client.get(f"/api/listings/{lid}").json()["view_count"]
        assert after > before

    def test_get_with_no_track_does_not_increment(self, client, created_listing):
        lid = created_listing["id"]
        before = client.get(f"/api/listings/{lid}", params={"no_track": True}).json()["view_count"]
        client.get(f"/api/listings/{lid}", params={"no_track": True})
        after = client.get(f"/api/listings/{lid}", params={"no_track": True}).json()["view_count"]
        assert after == before


# -- Create --------------------------------------------------------------------

class TestCreateListing:
    def test_create_returns_201(self, auth_client, listing_payload):
        resp = auth_client.post("/api/listings", json=listing_payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == listing_payload["title"]
        assert data["status"] == "active"
        assert float(data["price"]) == float(listing_payload["price"])

    def test_create_requires_auth(self, client, listing_payload):
        resp = client.post("/api/listings", json=listing_payload)
        assert resp.status_code == 401

    def test_create_invalid_category_returns_404(self, auth_client, listing_payload):
        payload = {**listing_payload, "category_id": "zzzzzzzzzz"}
        resp = auth_client.post("/api/listings", json=payload)
        assert resp.status_code == 404

    def test_create_missing_required_fields_returns_422(self, auth_client):
        resp = auth_client.post("/api/listings", json={"title": "Incomplete"})
        assert resp.status_code == 422

    def test_create_sets_seller_to_current_user(self, auth_client, user, listing_payload):
        resp = auth_client.post("/api/listings", json=listing_payload)
        assert resp.status_code == 201
        assert resp.json()["seller_id"] == user.public_id


# -- Update --------------------------------------------------------------------

class TestUpdateListing:
    def test_update_own_listing(self, auth_client, created_listing):
        resp = auth_client.patch(f"/api/listings/{created_listing['id']}", json={
            "title": "Updated Title",
            "price": "350.00",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Updated Title"
        assert float(data["price"]) == 350.0

    def test_mark_as_sold(self, auth_client, created_listing):
        resp = auth_client.patch(f"/api/listings/{created_listing['id']}", json={"status": "sold"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "sold"

    def test_mark_as_reserved(self, auth_client, created_listing):
        resp = auth_client.patch(f"/api/listings/{created_listing['id']}", json={"status": "reserved"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "reserved"

    def test_update_requires_auth(self, client, created_listing):
        resp = client.patch(f"/api/listings/{created_listing['id']}", json={"title": "Hacked"})
        assert resp.status_code == 401

    def test_update_other_users_listing_returns_403(self, auth_client2, created_listing):
        resp = auth_client2.patch(f"/api/listings/{created_listing['id']}", json={"title": "Hijacked"})
        assert resp.status_code == 403

    def test_update_nonexistent_listing_returns_404(self, auth_client):
        resp = auth_client.patch("/api/listings/zzzzzzzzzz", json={"title": "Ghost"})
        assert resp.status_code == 404


# -- Delete --------------------------------------------------------------------

class TestDeleteListing:
    def test_delete_soft_deletes_listing(self, auth_client, created_listing, db):
        resp = auth_client.delete(f"/api/listings/{created_listing['id']}")
        assert resp.status_code == 204
        from app.models.listing import Listing
        listing = db.query(Listing).filter(Listing.public_id == created_listing["id"]).first()
        assert listing.status == ListingStatus.INACTIVE

    def test_delete_requires_auth(self, client, created_listing):
        resp = client.delete(f"/api/listings/{created_listing['id']}")
        assert resp.status_code == 401

    def test_delete_other_users_listing_returns_403(self, auth_client2, created_listing):
        resp = auth_client2.delete(f"/api/listings/{created_listing['id']}")
        assert resp.status_code == 403

    def test_delete_nonexistent_returns_404(self, auth_client):
        resp = auth_client.delete("/api/listings/zzzzzzzzzz")
        assert resp.status_code == 404


# -- Stats ---------------------------------------------------------------------

class TestStats:
    def test_stats_returns_counts(self, client, created_listing):
        resp = client.get("/api/listings/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "active_listings" in data
        assert "active_sellers" in data

    def test_stats_excludes_inactive(self, auth_client, created_listing):
        auth_client.delete(f"/api/listings/{created_listing['id']}")
        resp = auth_client.get("/api/listings/stats")
        assert resp.status_code == 200
        assert resp.json()["active_listings"] == 0
