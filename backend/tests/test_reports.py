"""Tests for /api/reports and admin report management endpoints."""
import pytest


# -- Helpers -------------------------------------------------------------------

@pytest.fixture()
def created_listing(auth_client, listing_payload):
    resp = auth_client.post("/api/listings", json=listing_payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def created_report(client, created_listing):
    resp = client.post(f"/api/reports/listings/{created_listing['id']}", json={"reason": "scam"})
    assert resp.status_code == 201, resp.text
    return resp.json()


# -- Submit report -------------------------------------------------------------

class TestSubmitReport:
    def test_report_anonymous(self, client, created_listing):
        resp = client.post(f"/api/reports/listings/{created_listing['id']}", json={
            "reason": "spam",
        })
        assert resp.status_code == 201

    def test_report_logged_in(self, auth_client2, created_listing):
        resp = auth_client2.post(f"/api/reports/listings/{created_listing['id']}", json={
            "reason": "scam",
            "details": "This looks like a scam.",
        })
        assert resp.status_code == 201

    def test_report_invalid_reason_returns_400(self, client, created_listing):
        resp = client.post(f"/api/reports/listings/{created_listing['id']}", json={
            "reason": "bad_vibes",
        })
        assert resp.status_code == 400

    def test_report_nonexistent_listing_returns_404(self, client):
        resp = client.post("/api/reports/listings/zzzzzzzzzz", json={"reason": "spam"})
        assert resp.status_code == 404

    def test_report_with_details(self, client, created_listing):
        resp = client.post(f"/api/reports/listings/{created_listing['id']}", json={
            "reason": "other",
            "details": "Something seems off.",
        })
        assert resp.status_code == 201


# -- Admin: list reports -------------------------------------------------------

class TestAdminListReports:
    def test_list_reports_requires_auth(self, client):
        resp = client.get("/api/admin/reports")
        assert resp.status_code == 401

    def test_list_reports_empty(self, admin_client):
        resp = admin_client.get("/api/admin/reports")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_reports_shows_submitted(self, admin_client, created_report, created_listing):
        resp = admin_client.get("/api/admin/reports")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        item = data["items"][0]
        assert item["reason"] == "scam"
        assert item["listing"]["id"] == created_listing["id"]


# -- Admin: dismiss report -----------------------------------------------------

class TestAdminDismissReport:
    def test_dismiss_removes_report(self, admin_client, created_report):
        report_id = admin_client.get("/api/admin/reports").json()["items"][0]["id"]
        resp = admin_client.delete(f"/api/admin/reports/{report_id}")
        assert resp.status_code == 200
        remaining = admin_client.get("/api/admin/reports").json()["total"]
        assert remaining == 0

    def test_dismiss_nonexistent_returns_404(self, admin_client):
        resp = admin_client.delete("/api/admin/reports/99999")
        assert resp.status_code == 404

    def test_dismiss_requires_auth(self, client, created_report):
        resp = client.delete("/api/admin/reports/1")
        assert resp.status_code == 401


# -- Admin: action (deactivate listing) ---------------------------------------

class TestAdminActionReport:
    def test_action_deactivates_listing(self, admin_client, client, created_report, created_listing):
        report_id = admin_client.get("/api/admin/reports").json()["items"][0]["id"]
        resp = admin_client.post(f"/api/admin/reports/{report_id}/action")
        assert resp.status_code == 200

        # Listing should now be inactive (not visible in public list)
        listings = client.get("/api/listings").json()
        assert not any(l["id"] == created_listing["id"] for l in listings)

        # Report should be gone
        assert admin_client.get("/api/admin/reports").json()["total"] == 0

    def test_action_nonexistent_report_returns_404(self, admin_client):
        resp = admin_client.post("/api/admin/reports/99999/action")
        assert resp.status_code == 404

    def test_action_requires_auth(self, client):
        resp = client.post("/api/admin/reports/1/action")
        assert resp.status_code == 401
