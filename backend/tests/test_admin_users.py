"""Admin user tools: detail page, notes/trust, purge + email block."""
import os

import pytest

from app.models.blocked_email import BlockedEmail
from app.models.favorite import Favorite
from app.models.listing import Listing
from app.models.message import Conversation, Message
from app.models.user import User
from app.routers.auth import _create_otp_token


@pytest.fixture()
def spammer_setup(auth_client, auth_client2, admin_client, listing_payload, user, user2, db, monkeypatch):
    """`user` posts a listing, `user2` favorites it and messages about it, then `user` is suspended."""
    deleted = []
    monkeypatch.setattr("app.purge.delete_listing_image", lambda key, settings: deleted.append(key))
    lid = auth_client.post("/api/listings", json=listing_payload).json()["id"]
    listing = db.query(Listing).filter(Listing.public_id == lid).one()
    listing.images = ["listings/1/a.jpg", "listings/1/b.jpg"]
    db.commit()
    auth_client2.post(f"/api/favorites/{lid}")
    conv = Conversation(listing_id=listing.id, buyer_id=user2.id, seller_id=user.id)
    db.add(conv)
    db.flush()
    db.add(Message(conversation_id=conv.id, sender_id=user2.id, body="Still available?"))
    db.commit()
    admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
    return {"listing_id": listing.id, "conv_id": conv.id, "deleted_images": deleted}


class TestPurge:
    def test_purge_removes_everything_and_blocks_email(self, admin_client, spammer_setup, user, db):
        email, uid = user.email, user.id
        resp = admin_client.post(f"/api/admin/users/{user.public_id}/purge", json={"reason": "bumper spam"})
        assert resp.status_code == 200
        assert resp.json() == {"listings": 1, "conversations": 1, "images": 2}
        db.expire_all()
        assert db.query(User).filter(User.id == uid).first() is None
        assert db.query(Listing).filter(Listing.id == spammer_setup["listing_id"]).first() is None
        assert db.query(Conversation).filter(Conversation.id == spammer_setup["conv_id"]).first() is None
        assert db.query(Message).filter(Message.conversation_id == spammer_setup["conv_id"]).count() == 0
        assert db.query(Favorite).filter(Favorite.listing_id == spammer_setup["listing_id"]).count() == 0
        assert db.query(BlockedEmail).filter(BlockedEmail.email == email.lower()).one().reason == "bumper spam"
        assert spammer_setup["deleted_images"] == ["listings/1/a.jpg", "listings/1/b.jpg"]

    def test_shared_images_are_kept(self, admin_client, spammer_setup, auth_client2, listing_payload, user, db):
        lid = auth_client2.post("/api/listings", json=listing_payload).json()["id"]
        db.query(Listing).filter(Listing.public_id == lid).update({Listing.images: ["listings/1/a.jpg"]})
        db.commit()
        resp = admin_client.post(f"/api/admin/users/{user.public_id}/purge", json={})
        assert resp.json()["images"] == 1
        assert spammer_setup["deleted_images"] == ["listings/1/b.jpg"]

    def test_other_users_are_untouched(self, admin_client, spammer_setup, user, user2, db):
        admin_client.post(f"/api/admin/users/{user.public_id}/purge", json={})
        db.expire_all()
        assert db.query(User).filter(User.id == user2.id).one().is_active

    def test_active_user_cannot_be_purged(self, admin_client, user2):
        resp = admin_client.post(f"/api/admin/users/{user2.public_id}/purge", json={})
        assert resp.status_code == 400

    def test_purge_all_suspended(self, admin_client, spammer_setup, user2, db):
        resp = admin_client.post("/api/admin/users/purge-suspended", json={})
        assert resp.json()["users"] == 1
        db.expire_all()
        assert db.query(User).filter(User.id == user2.id).first() is not None

    def test_requires_admin(self, auth_client2, spammer_setup, user):
        assert auth_client2.post(f"/api/admin/users/{user.public_id}/purge", json={}).status_code == 401


class TestEmailBlock:
    @pytest.fixture(autouse=True)
    def dev_otp(self):
        os.environ["DEV_OTP_CODE"] = "123456"
        yield
        os.environ.pop("DEV_OTP_CODE", None)

    @pytest.fixture()
    def blocked(self, db):
        db.add(BlockedEmail(email="spam@example.com"))
        db.commit()

    def test_blocked_email_cannot_request_code(self, client, blocked):
        resp = client.post("/api/auth/otp-send", json={"email": "Spam@Example.com"})
        assert resp.status_code == 403

    def test_blocked_email_cannot_verify(self, client, blocked):
        resp = client.post("/api/auth/otp-verify", json={
            "email": "spam@example.com", "code": "123456",
            "otp_token": _create_otp_token("spam@example.com", "123456"),
        })
        assert resp.status_code == 403

    def test_unblock(self, admin_client, client, blocked, db):
        bid = admin_client.get("/api/admin/blocked-emails").json()[0]["id"]
        assert admin_client.delete(f"/api/admin/blocked-emails/{bid}").status_code == 204
        assert client.post("/api/auth/otp-send", json={"email": "spam@example.com"}).status_code == 200


class TestDetailAndMeta:
    def test_detail(self, admin_client, auth_client, listing_payload, user):
        auth_client.post("/api/listings", json=listing_payload)
        d = admin_client.get(f"/api/admin/users/{user.public_id}").json()
        assert d["email"] == user.email
        assert len(d["listings"]) == 1
        assert d["listings"][0]["title"] == listing_payload["title"]

    def test_note_and_trust(self, admin_client, user, db):
        resp = admin_client.patch(f"/api/admin/users/{user.public_id}/meta",
                                  json={"admin_note": "Knows the owner", "is_trusted": True})
        assert resp.status_code == 200
        db.expire_all()
        u = db.query(User).filter(User.id == user.id).one()
        assert (u.admin_note, u.is_trusted) == ("Knows the owner", True)

    def test_list_filters_suspended(self, admin_client, user, user2):
        admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
        items = admin_client.get("/api/admin/users?status=suspended").json()["items"]
        assert [u["id"] for u in items] == [user.public_id]

    def test_signup_country_recorded(self, client, db, monkeypatch):
        monkeypatch.setattr("app.routers.auth.country_for_ip", lambda ip: "AW")
        os.environ["DEV_OTP_CODE"] = "123456"
        try:
            client.post("/api/auth/otp-verify", json={
                "email": "new@example.com", "code": "123456",
                "otp_token": _create_otp_token("new@example.com", "123456"),
            })
        finally:
            os.environ.pop("DEV_OTP_CODE", None)
        assert db.query(User).filter(User.email == "new@example.com").one().signup_country == "AW"
