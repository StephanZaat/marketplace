"""Tests for /api/auth endpoints: register, login, me, password reset."""
import pytest


class TestRegister:
    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "password": "password123",
            "full_name": "New User",
        })
        assert resp.status_code == 201
        assert "access_token" in resp.json()

    def test_register_duplicate_email(self, client, user):
        resp = client.post("/api/auth/register", json={
            "email": user.email,
            "password": "password123",
            "full_name": "Other User",
        })
        assert resp.status_code == 400
        assert "email" in resp.json()["detail"].lower()

    def test_register_invalid_email_returns_422(self, client):
        resp = client.post("/api/auth/register", json={
            "email": "not-an-email",
            "password": "password123",
            "full_name": "Someone",
        })
        assert resp.status_code == 422

    def test_register_missing_fields_returns_422(self, client):
        resp = client.post("/api/auth/register", json={"email": "x@x.com"})
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client, user):
        resp = client.post("/api/auth/login", json={
            "email": user.email,
            "password": "password123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password(self, client, user):
        resp = client.post("/api/auth/login", json={
            "email": user.email,
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_login_unknown_email(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@example.com",
            "password": "password123",
        })
        assert resp.status_code == 401

    def test_login_suspended_user_returns_403(self, client, db, user):
        user.is_active = False
        db.commit()
        resp = client.post("/api/auth/login", json={
            "email": user.email,
            "password": "password123",
        })
        assert resp.status_code == 403


class TestMe:
    def test_me_returns_current_user(self, auth_client, user):
        resp = auth_client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == user.email
        assert data["full_name"] == user.full_name

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        resp = client.get("/api/auth/me", headers={"Authorization": "Bearer badtoken"})
        assert resp.status_code == 401


class TestPasswordReset:
    def test_forgot_password_always_returns_202(self, client):
        # Returns 202 even for unknown email (avoid enumeration)
        resp = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
        assert resp.status_code == 202

    def test_forgot_password_known_email_returns_202(self, client, user):
        resp = client.post("/api/auth/forgot-password", json={"email": user.email})
        assert resp.status_code == 202

    def test_reset_password_with_invalid_token_returns_400(self, client):
        resp = client.post("/api/auth/reset-password", json={
            "token": "invalid-token",
            "new_password": "newpassword123",
        })
        assert resp.status_code == 400

    def test_reset_password_success(self, client, db, user):
        import secrets
        from datetime import datetime, timedelta
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        # Use naive datetime so it's compatible with both SQLite (naive) and Postgres (aware)
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        resp = client.post("/api/auth/reset-password", json={
            "token": token,
            "new_password": "newpassword456",
        })
        assert resp.status_code == 200

        # Old password should no longer work
        login_resp = client.post("/api/auth/login", json={
            "email": user.email,
            "password": "password123",
        })
        assert login_resp.status_code == 401

        # New password should work
        login_resp2 = client.post("/api/auth/login", json={
            "email": user.email,
            "password": "newpassword456",
        })
        assert login_resp2.status_code == 200

    def test_reset_password_too_short_returns_400(self, client, db, user):
        import secrets
        from datetime import datetime, timedelta
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        resp = client.post("/api/auth/reset-password", json={
            "token": token,
            "new_password": "abc",
        })
        assert resp.status_code == 400


class TestHealth:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
