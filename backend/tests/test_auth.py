"""Tests for /api/auth OTP endpoints."""
import os
import pytest
from app.routers.auth import _create_otp_token


@pytest.fixture(autouse=True)
def dev_otp_code():
    os.environ["DEV_OTP_CODE"] = "123456"
    yield
    os.environ.pop("DEV_OTP_CODE", None)


class TestOtpSend:
    def test_otp_send_returns_token(self, client):
        resp = client.post("/api/auth/otp-send", json={"email": "test@example.com"})
        assert resp.status_code == 200
        data = resp.json()
        assert "otp_token" in data
        assert data["is_new_user"] is True

    def test_otp_send_existing_user(self, client, user):
        resp = client.post("/api/auth/otp-send", json={"email": user.email})
        assert resp.status_code == 200
        assert resp.json()["is_new_user"] is False

    def test_otp_send_invalid_email_returns_422(self, client):
        resp = client.post("/api/auth/otp-send", json={"email": "not-an-email"})
        assert resp.status_code == 422


class TestOtpVerify:
    def test_verify_existing_user(self, client, user):
        otp_token = _create_otp_token(user.email, "123456")
        resp = client.post("/api/auth/otp-verify", json={
            "email": user.email,
            "code": "123456",
            "otp_token": otp_token,
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_verify_auto_creates_new_user(self, client, db):
        email = "brand_new@example.com"
        otp_token = _create_otp_token(email, "123456")
        resp = client.post("/api/auth/otp-verify", json={
            "email": email,
            "code": "123456",
            "otp_token": otp_token,
            "full_name": "Brand New",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

        from app.models.user import User
        u = db.query(User).filter(User.email == email).first()
        assert u is not None
        assert u.full_name == "Brand New"

    def test_verify_wrong_code_returns_401(self, client, user):
        otp_token = _create_otp_token(user.email, "123456")
        resp = client.post("/api/auth/otp-verify", json={
            "email": user.email,
            "code": "999999",
            "otp_token": otp_token,
        })
        assert resp.status_code == 401

    def test_verify_expired_token_returns_401(self, client, user):
        resp = client.post("/api/auth/otp-verify", json={
            "email": user.email,
            "code": "123456",
            "otp_token": "expired.invalid.token",
        })
        assert resp.status_code == 401

    def test_verify_disabled_user_returns_403(self, client, db, user):
        user.is_active = False
        db.commit()
        otp_token = _create_otp_token(user.email, "123456")
        resp = client.post("/api/auth/otp-verify", json={
            "email": user.email,
            "code": "123456",
            "otp_token": otp_token,
        })
        assert resp.status_code == 403

    def test_verify_new_user_default_name(self, client, db):
        email = "noname@example.com"
        otp_token = _create_otp_token(email, "123456")
        resp = client.post("/api/auth/otp-verify", json={
            "email": email,
            "code": "123456",
            "otp_token": otp_token,
        })
        assert resp.status_code == 200
        from app.models.user import User
        u = db.query(User).filter(User.email == email).first()
        assert u.full_name == "noname"


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


class TestHealth:
    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
