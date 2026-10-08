"""Admin gets an email for each sign-up and each new live listing."""
import os

import pytest

from app import email as mail
from app.routers.auth import _create_otp_token


@pytest.fixture()
def sent(monkeypatch):
    """Capture outgoing emails instead of sending them."""
    out = []

    async def fake_send(to, subject, html, text=None):
        out.append({"to": to, "subject": subject, "text": text})

    monkeypatch.setattr(mail, "_send", fake_send)
    monkeypatch.setattr(mail.settings, "support_email", "support@marketplace.aw")
    monkeypatch.setattr(mail.settings, "admin_notify_email", None)
    return out


def _admin_mails(sent):
    return [m for m in sent if m["to"] == "support@marketplace.aw"]


def test_signup_notifies_admin(client, sent, monkeypatch):
    monkeypatch.setattr("app.routers.auth.country_for_ip", lambda ip: "AW")
    os.environ["DEV_OTP_CODE"] = "123456"
    try:
        client.post("/api/auth/otp-verify", json={
            "email": "new.seller@example.com", "code": "123456",
            "otp_token": _create_otp_token("new.seller@example.com", "123456"), "full_name": "New Seller",
        })
    finally:
        os.environ.pop("DEV_OTP_CODE", None)
    [m] = _admin_mails(sent)
    assert m["subject"] == "[Sign-up] New Seller (AW)"
    assert "new.seller@example.com" in m["text"]


def test_existing_user_login_does_not_notify(client, user, sent):
    os.environ["DEV_OTP_CODE"] = "123456"
    try:
        client.post("/api/auth/otp-verify", json={
            "email": user.email, "code": "123456", "otp_token": _create_otp_token(user.email, "123456"),
        })
    finally:
        os.environ.pop("DEV_OTP_CODE", None)
    assert _admin_mails(sent) == []


def test_live_listing_notifies_admin(auth_client, listing_payload, sent):
    auth_client.post("/api/listings", json=listing_payload)
    [m] = _admin_mails(sent)
    assert m["subject"].startswith(f"[Listing] {listing_payload['title']}")
    assert "/admin/listings/" in m["text"]


def test_held_listing_sends_review_request_only(auth_client, listing_payload, sent, monkeypatch):
    monkeypatch.setattr("app.routers.listings.country_for_ip", lambda ip: "VN")
    auth_client.post("/api/listings", json=listing_payload)
    assert [m["subject"].split("]")[0] for m in _admin_mails(sent)] == ["[Review"]


def test_custom_recipient_and_off_switch(auth_client, listing_payload, sent, monkeypatch):
    monkeypatch.setattr(mail.settings, "admin_notify_email", "owner@example.com")
    auth_client.post("/api/listings", json=listing_payload)
    assert any(m["to"] == "owner@example.com" for m in sent)
    sent.clear()
    monkeypatch.setattr(mail.settings, "admin_notify_email", "")
    auth_client.post("/api/listings", json=listing_payload)
    assert not any(m["subject"].startswith("[Listing]") for m in sent)
