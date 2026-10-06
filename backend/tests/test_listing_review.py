"""Off-island review: untrusted sellers posting from outside Aruba are held for admin approval."""
import pytest

from app.models.listing import Listing, ListingStatus
from app.models.user import User


@pytest.fixture()
def posted_from(monkeypatch):
    """Set the country the next listing appears to be posted from."""
    def _set(country):
        monkeypatch.setattr("app.routers.listings.country_for_ip", lambda ip: country)
    return _set


def _create(auth_client, listing_payload):
    resp = auth_client.post("/api/listings", json=listing_payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestHold:
    def test_untrusted_seller_abroad_is_held(self, auth_client, listing_payload, posted_from):
        posted_from("VN")
        assert _create(auth_client, listing_payload)["status"] == "pending"

    def test_untrusted_seller_in_aruba_is_published(self, auth_client, listing_payload, posted_from):
        posted_from("AW")
        assert _create(auth_client, listing_payload)["status"] == "active"

    def test_unknown_country_is_published(self, auth_client, listing_payload, posted_from):
        posted_from(None)
        assert _create(auth_client, listing_payload)["status"] == "active"

    def test_trusted_seller_abroad_is_published(self, auth_client, listing_payload, posted_from, user, db):
        user.is_trusted = True
        db.commit()
        posted_from("US")
        assert _create(auth_client, listing_payload)["status"] == "active"

    def test_country_is_recorded(self, auth_client, listing_payload, posted_from, db):
        posted_from("VN")
        lid = _create(auth_client, listing_payload)["id"]
        assert db.query(Listing).filter(Listing.public_id == lid).one().created_country == "VN"


class TestVisibility:
    @pytest.fixture()
    def pending(self, auth_client, listing_payload, posted_from):
        posted_from("VN")
        return _create(auth_client, listing_payload)

    def test_hidden_from_public_list(self, client, pending):
        assert pending["id"] not in [l["id"] for l in client.get("/api/listings").json()]

    def test_hidden_from_seller_filtered_list_for_others(self, auth_client2, pending):
        resp = auth_client2.get(f"/api/listings?seller_id={pending['seller_id']}&status=pending")
        assert pending["id"] not in [l["id"] for l in resp.json()]

    def test_visible_to_owner_in_list(self, auth_client, pending):
        resp = auth_client.get(f"/api/listings?seller_id={pending['seller_id']}&status=pending")
        assert pending["id"] in [l["id"] for l in resp.json()]

    def test_detail_404_for_others(self, client, auth_client2, pending):
        assert client.get(f"/api/listings/{pending['id']}").status_code == 404
        assert auth_client2.get(f"/api/listings/{pending['id']}").status_code == 404

    def test_detail_visible_to_owner(self, auth_client, pending):
        resp = auth_client.get(f"/api/listings/{pending['id']}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"


class TestSellerStatusChanges:
    def test_cannot_publish_own_pending_listing(self, auth_client, listing_payload, posted_from):
        posted_from("VN")
        lid = _create(auth_client, listing_payload)["id"]
        resp = auth_client.patch(f"/api/listings/{lid}", json={"status": "active"})
        assert resp.status_code == 400

    def test_cannot_reactivate_removed_listing(self, auth_client, listing_payload, db):
        lid = _create(auth_client, listing_payload)["id"]
        db.query(Listing).filter(Listing.public_id == lid).update({Listing.status: ListingStatus.INACTIVE})
        db.commit()
        assert auth_client.patch(f"/api/listings/{lid}", json={"status": "active"}).status_code == 400

    def test_can_still_mark_sold_and_relist(self, auth_client, listing_payload):
        lid = _create(auth_client, listing_payload)["id"]
        assert auth_client.patch(f"/api/listings/{lid}", json={"status": "sold"}).status_code == 200
        assert auth_client.patch(f"/api/listings/{lid}", json={"status": "active"}).status_code == 200

    def test_can_edit_pending_listing_content(self, auth_client, listing_payload, posted_from):
        posted_from("VN")
        lid = _create(auth_client, listing_payload)["id"]
        resp = auth_client.patch(f"/api/listings/{lid}", json={"title": "Fixed title"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"


class TestAdminReview:
    def test_approve_publishes_and_trusts_seller(self, auth_client, admin_client, listing_payload, posted_from, user, db):
        posted_from("VN")
        lid = _create(auth_client, listing_payload)["id"]
        resp = admin_client.post(f"/api/admin/listings/{lid}/approve")
        assert resp.status_code == 200
        db.expire_all()
        assert db.query(Listing).filter(Listing.public_id == lid).one().status == ListingStatus.ACTIVE
        assert db.query(User).filter(User.id == user.id).one().is_trusted
        # Next listing from abroad goes straight through
        assert _create(auth_client, listing_payload)["status"] == "active"

    def test_approve_rejects_non_pending(self, auth_client, admin_client, listing_payload):
        lid = _create(auth_client, listing_payload)["id"]
        assert admin_client.post(f"/api/admin/listings/{lid}/approve").status_code == 400

    def test_approve_requires_admin(self, auth_client, listing_payload, posted_from):
        posted_from("VN")
        lid = _create(auth_client, listing_payload)["id"]
        assert auth_client.post(f"/api/admin/listings/{lid}/approve").status_code == 401

    def test_admin_list_includes_review_context(self, auth_client, admin_client, listing_payload, posted_from):
        posted_from("VN")
        _create(auth_client, listing_payload)
        items = admin_client.get("/api/admin/listings?status=pending").json()["items"]
        assert len(items) == 1
        assert items[0]["created_country"] == "VN"
        assert items[0]["description"] == listing_payload["description"]
        assert items[0]["seller_trusted"] is False

    def test_stats_count_pending(self, auth_client, admin_client, listing_payload, posted_from):
        posted_from("VN")
        _create(auth_client, listing_payload)
        stats = admin_client.get("/api/admin/stats").json()
        assert stats["pending_listings"] == 1
        assert isinstance(stats["geoip_enabled"], bool)


class TestDeactivation:
    def test_deactivating_seller_takes_listings_down(self, auth_client, admin_client, client, listing_payload, user):
        lid = _create(auth_client, listing_payload)["id"]
        resp = admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
        assert resp.status_code == 200
        assert lid not in [l["id"] for l in client.get("/api/listings").json()]
        assert client.get(f"/api/listings/{lid}").status_code == 404

    def test_sold_listings_are_kept(self, auth_client, admin_client, listing_payload, user, db):
        lid = _create(auth_client, listing_payload)["id"]
        auth_client.patch(f"/api/listings/{lid}", json={"status": "sold"})
        admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
        db.expire_all()
        assert db.query(Listing).filter(Listing.public_id == lid).one().status == ListingStatus.SOLD
