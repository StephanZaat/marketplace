"""Tests for admin auth + admin management endpoints."""
import pytest
from app.models.listing import ListingStatus


# -- Helpers -------------------------------------------------------------------

@pytest.fixture()
def created_listing(auth_client, listing_payload):
    resp = auth_client.post("/api/listings", json=listing_payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# -- Admin auth ----------------------------------------------------------------

class TestAdminAuth:
    def test_login_success(self, client, admin):
        form = {"username": admin.username, "password": "adminpass"}
        resp = client.post("/api/admin/auth/token", data=form)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["totp_required"] is False

    def test_login_wrong_password(self, client, admin):
        form = {"username": admin.username, "password": "wrongpass"}
        resp = client.post("/api/admin/auth/token", data=form)
        assert resp.status_code == 401

    def test_login_unknown_user(self, client):
        form = {"username": "nobody", "password": "whatever"}
        resp = client.post("/api/admin/auth/token", data=form)
        assert resp.status_code == 401

    def test_me_returns_admin(self, admin_client, admin):
        resp = admin_client.get("/api/admin/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == admin.username
        assert data["totp_enabled"] is False

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/api/admin/auth/me")
        assert resp.status_code == 401

    def test_user_token_cannot_access_admin_me(self, auth_client):
        resp = auth_client.get("/api/admin/auth/me")
        assert resp.status_code == 401


# -- Admin stats ---------------------------------------------------------------

class TestAdminStats:
    def test_stats_requires_auth(self, client):
        resp = client.get("/api/admin/stats")
        assert resp.status_code == 401

    def test_stats_returns_expected_fields(self, admin_client, user, created_listing):
        resp = admin_client.get("/api/admin/stats")
        assert resp.status_code == 200
        data = resp.json()
        for field in ("total_users", "active_users", "total_listings", "active_listings",
                      "sold_listings", "inactive_listings", "total_reports"):
            assert field in data

    def test_stats_counts_active_listing(self, admin_client, user, created_listing):
        resp = admin_client.get("/api/admin/stats")
        assert resp.json()["active_listings"] >= 1


# -- Admin listings ------------------------------------------------------------

class TestAdminListings:
    def test_list_listings_requires_auth(self, client):
        resp = client.get("/api/admin/listings")
        assert resp.status_code == 401

    def test_list_listings(self, admin_client, created_listing):
        resp = admin_client.get("/api/admin/listings")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "items" in data
        assert data["total"] >= 1

    def test_list_listings_filter_by_status(self, admin_client, created_listing):
        resp = admin_client.get("/api/admin/listings", params={"status": "active"})
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["status"] == "active"

    def test_list_listings_search(self, admin_client, created_listing):
        resp = admin_client.get("/api/admin/listings", params={"q": "iPhone"})
        assert resp.status_code == 200
        ids = [l["id"] for l in resp.json()["items"]]
        assert created_listing["id"] in ids

    def test_list_listings_search_no_match(self, admin_client, created_listing):
        resp = admin_client.get("/api/admin/listings", params={"q": "xyznotfound"})
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_update_listing_status(self, admin_client, created_listing):
        lid = created_listing["id"]
        resp = admin_client.patch(f"/api/admin/listings/{lid}", json={"status": "inactive"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "inactive"

    def test_update_listing_invalid_status_returns_400(self, admin_client, created_listing):
        lid = created_listing["id"]
        resp = admin_client.patch(f"/api/admin/listings/{lid}", json={"status": "nonsense"})
        assert resp.status_code == 400

    def test_update_nonexistent_listing_returns_404(self, admin_client):
        resp = admin_client.patch("/api/admin/listings/zzzzzzzzzz", json={"status": "active"})
        assert resp.status_code == 404

    def test_update_requires_auth(self, client, created_listing):
        resp = client.patch(f"/api/admin/listings/{created_listing['id']}", json={"status": "inactive"})
        assert resp.status_code == 401


# -- Admin users ---------------------------------------------------------------

class TestAdminUsers:
    def test_list_users_requires_auth(self, client):
        resp = client.get("/api/admin/users")
        assert resp.status_code == 401

    def test_list_users(self, admin_client, user):
        resp = admin_client.get("/api/admin/users")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        emails = [u["email"] for u in data["items"]]
        assert user.email in emails

    def test_list_users_search_by_email(self, admin_client, user):
        resp = admin_client.get("/api/admin/users", params={"q": user.email})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert any(u["email"] == user.email for u in data["items"])

    def test_list_users_search_no_match(self, admin_client, user):
        resp = admin_client.get("/api/admin/users", params={"q": "xyznotfound@example.com"})
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_suspend_user(self, admin_client, user):
        resp = admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_reactivate_user(self, admin_client, db, user):
        user.is_active = False
        db.commit()
        resp = admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": True})
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    def test_update_nonexistent_user_returns_404(self, admin_client):
        resp = admin_client.patch("/api/admin/users/zzzzzzzzzz", json={"is_active": False})
        assert resp.status_code == 404

    def test_update_requires_auth(self, client, user):
        resp = client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
        assert resp.status_code == 401

    def test_suspended_user_cannot_login(self, admin_client, client, user):
        import os
        os.environ["DEV_OTP_CODE"] = "123456"
        try:
            admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
            from app.routers.auth import _create_otp_token
            otp_token = _create_otp_token(user.email, "123456")
            resp = client.post("/api/auth/otp-verify", json={
                "email": user.email,
                "code": "123456",
                "otp_token": otp_token,
            })
            assert resp.status_code == 403
        finally:
            os.environ.pop("DEV_OTP_CODE", None)
