"""Tests for /api/users endpoints."""
import pytest


# -- Get user profile ----------------------------------------------------------

class TestGetUser:
    def test_get_user_profile(self, client, user):
        resp = client.get(f"/api/users/{user.public_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == user.public_id
        assert data["full_name"] == user.full_name
        assert "created_at" in data

    def test_get_nonexistent_user_returns_404(self, client):
        resp = client.get("/api/users/zzzzzzzzzz")
        assert resp.status_code == 404

    def test_get_suspended_user_returns_404(self, client, db, user):
        user.is_active = False
        db.commit()
        resp = client.get(f"/api/users/{user.public_id}")
        assert resp.status_code == 404

    def test_profile_includes_rating_fields(self, client, user):
        resp = client.get(f"/api/users/{user.public_id}")
        data = resp.json()
        assert "avg_rating" in data
        assert "rating_count" in data
        assert data["rating_count"] == 0

    def test_phone_hidden_when_not_in_contact_method(self, client, db, user):
        user.phone = "+1234567890"
        user.contact_method = "whatsapp"
        db.commit()
        resp = client.get(f"/api/users/{user.public_id}")
        assert resp.json()["phone"] is None

    def test_phone_visible_when_in_contact_method(self, client, db, user):
        user.phone = "+1234567890"
        user.contact_method = "phone,whatsapp"
        db.commit()
        resp = client.get(f"/api/users/{user.public_id}")
        assert resp.json()["phone"] == "+1234567890"


# -- Update own profile --------------------------------------------------------

class TestUpdateMe:
    def test_update_full_name(self, auth_client, user):
        resp = auth_client.patch("/api/users/me", json={"full_name": "Alice Updated"})
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Alice Updated"

    def test_update_bio(self, auth_client):
        resp = auth_client.patch("/api/users/me", json={"bio": "Hello world"})
        assert resp.status_code == 200
        assert resp.json()["bio"] == "Hello world"

    def test_update_multiple_fields(self, auth_client):
        resp = auth_client.patch("/api/users/me", json={
            "location": "Aruba",
            "languages": "en,nl",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["location"] == "Aruba"
        assert data["languages"] == "en,nl"

    def test_update_requires_auth(self, client):
        resp = client.patch("/api/users/me", json={"full_name": "Hacker"})
        assert resp.status_code == 401

    def test_update_returns_email(self, auth_client, user):
        resp = auth_client.patch("/api/users/me", json={"bio": "test"})
        assert resp.status_code == 200
        assert resp.json()["email"] == user.email
