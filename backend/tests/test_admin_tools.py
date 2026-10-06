"""Admin listing edit/bulk, category management, featured listings and insights."""
import pytest

from app.models.category import Category
from app.models.listing import Listing, ListingStatus


def _create(auth_client, payload):
    resp = auth_client.post("/api/listings", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class TestListingEdit:
    def test_edit_fields_and_category(self, admin_client, auth_client, listing_payload, db):
        lid = _create(auth_client, listing_payload)
        other = Category(name="Mountain Bikes", slug="mtb-test", sort_order=0, attributes=[])
        db.add(other)
        db.commit()
        resp = admin_client.patch(f"/api/admin/listings/{lid}/edit",
                                  json={"title": "Cannondale Jekyll", "price": "800", "category_id": other.public_id})
        assert resp.status_code == 200, resp.text
        d = resp.json()
        assert (d["title"], d["price"], d["category_id"]) == ("Cannondale Jekyll", "800.00", other.public_id)

    def test_detail_includes_description_and_seller(self, admin_client, auth_client, listing_payload, user):
        lid = _create(auth_client, listing_payload)
        d = admin_client.get(f"/api/admin/listings/{lid}").json()
        assert d["description"] == listing_payload["description"]
        assert d["seller"]["email"] == user.email

    def test_edit_requires_admin(self, auth_client, listing_payload):
        lid = _create(auth_client, listing_payload)
        assert auth_client.patch(f"/api/admin/listings/{lid}/edit", json={"title": "x"}).status_code == 401


class TestBulk:
    def test_bulk_approve_reports_failures(self, admin_client, auth_client, listing_payload, monkeypatch, db):
        monkeypatch.setattr("app.routers.listings.country_for_ip", lambda ip: "VN")
        pending = _create(auth_client, listing_payload)
        monkeypatch.setattr("app.routers.listings.country_for_ip", lambda ip: "AW")
        # seller isn't trusted yet, but AW listings publish directly
        active = _create(auth_client, listing_payload)
        resp = admin_client.post("/api/admin/listings/bulk", json={"ids": [pending, active, "nope"], "action": "approve"})
        body = resp.json()
        assert body["done"] == [pending]
        assert body["failed"] == {active: "not pending", "nope": "not found"}

    def test_bulk_deactivate_and_feature(self, admin_client, auth_client, listing_payload, db):
        a, b = _create(auth_client, listing_payload), _create(auth_client, listing_payload)
        admin_client.post("/api/admin/listings/bulk", json={"ids": [a], "action": "deactivate"})
        admin_client.post("/api/admin/listings/bulk", json={"ids": [b], "action": "feature"})
        db.expire_all()
        assert db.query(Listing).filter(Listing.public_id == a).one().status == ListingStatus.INACTIVE
        assert db.query(Listing).filter(Listing.public_id == b).one().is_featured


class TestFeatured:
    def test_featured_filter(self, admin_client, auth_client, client, listing_payload):
        a, b = _create(auth_client, listing_payload), _create(auth_client, listing_payload)
        admin_client.patch(f"/api/admin/listings/{a}/edit", json={"is_featured": True})
        ids = [l["id"] for l in client.get("/api/listings?featured=true").json()]
        assert ids == [a]


class TestCategories:
    def test_create_edit_delete(self, admin_client, category):
        resp = admin_client.post("/api/admin/categories", json={"name": "Boats & Kayaks", "parent_id": category.public_id})
        assert resp.status_code == 201
        cid, slug = resp.json()["id"], resp.json()["slug"]
        assert slug == "boats-kayaks"
        assert admin_client.patch(f"/api/admin/categories/{cid}", json={"name": "Boats"}).status_code == 200
        assert admin_client.delete(f"/api/admin/categories/{cid}").status_code == 204

    def test_slug_is_unique(self, admin_client):
        admin_client.post("/api/admin/categories", json={"name": "Tools"})
        assert admin_client.post("/api/admin/categories", json={"name": "Tools"}).json()["slug"] == "tools-2"

    def test_cannot_delete_with_listings(self, admin_client, auth_client, listing_payload, category):
        _create(auth_client, listing_payload)
        assert admin_client.delete(f"/api/admin/categories/{category.public_id}").status_code == 400

    def test_cannot_move_under_itself(self, admin_client):
        parent = admin_client.post("/api/admin/categories", json={"name": "P"}).json()["id"]
        child = admin_client.post("/api/admin/categories", json={"name": "C", "parent_id": parent}).json()["id"]
        resp = admin_client.patch(f"/api/admin/categories/{parent}", json={"parent_id": child})
        assert resp.status_code == 400

    def test_hidden_category_and_children_disappear(self, admin_client, client, auth_client, listing_payload, category):
        child = admin_client.post("/api/admin/categories", json={"name": "Sub", "parent_id": category.public_id}).json()["id"]
        admin_client.patch(f"/api/admin/categories/{category.public_id}", json={"is_hidden": True})
        ids = {c["id"] for c in client.get("/api/categories").json()}
        assert category.public_id not in ids and child not in ids
        assert auth_client.post("/api/listings", json=listing_payload).status_code == 400

    def test_requires_admin(self, auth_client):
        assert auth_client.post("/api/admin/categories", json={"name": "x"}).status_code == 401


class TestInsights:
    def test_weekly_series_and_totals(self, admin_client, auth_client, listing_payload, user):
        _create(auth_client, listing_payload)
        d = admin_client.get("/api/admin/insights?weeks=8").json()
        assert len(d["weeks"]) == 8
        assert d["weeks"][-1]["listings"] == 1
        assert d["weeks"][-1]["signups"] >= 1
        assert d["totals"]["active_listings"] == 1
        assert d["last30"]["listings"] == 1
        assert d["top_listings"][0]["title"] == listing_payload["title"]
