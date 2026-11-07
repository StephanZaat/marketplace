"""Instant photo upload: POST/DELETE /api/uploads, attaching on listing create/edit,
stale cleanup and purge. Files go to a tmp dir, never to S3."""
import io
from datetime import datetime, timedelta, timezone

import pytest
from PIL import Image

from app import pending_uploads, storage
from app.config import get_settings
from app.models.listing import Listing
from app.models.upload import Upload


def _jpeg(name="photo.jpg"):
    buf = io.BytesIO()
    Image.new("RGB", (40, 30), "teal").save(buf, format="JPEG")
    return {"file": (name, buf.getvalue(), "image/jpeg")}


@pytest.fixture(autouse=True)
def images_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "_IMAGES_DIR", tmp_path)
    return tmp_path


def _upload(client, name="photo.jpg"):
    resp = client.post("/api/uploads", files=_jpeg(name))
    assert resp.status_code == 201, resp.text
    return resp.json()["key"]


def _create(client, payload, images):
    return client.post("/api/listings", json={**payload, "images": images})


class TestUpload:
    def test_upload_stores_photo_and_thumbnail(self, auth_client, user, db, images_dir):
        resp = auth_client.post("/api/uploads", files=_jpeg("My Photo.PNG"))
        assert resp.status_code == 201
        body = resp.json()
        key = body["key"]
        assert key.startswith(f"uploads/{user.public_id}/my-photo-") and key.endswith(".jpg")
        assert body["url"].endswith(key)
        assert body["thumbnail"].endswith(key[:-4] + "_thumb.jpg")
        assert (images_dir / key).exists() and (images_dir / (key[:-4] + "_thumb.jpg")).exists()
        assert db.query(Upload).filter(Upload.key == key, Upload.user_id == user.id).count() == 1

    def test_unsupported_type(self, auth_client):
        assert auth_client.post("/api/uploads", files=_jpeg("anim.gif")).status_code == 400

    def test_requires_auth(self, client):
        assert client.post("/api/uploads", files=_jpeg()).status_code == 401


class TestDelete:
    def test_delete_own_upload(self, auth_client, db, images_dir):
        key = _upload(auth_client)
        assert auth_client.delete("/api/uploads", params={"key": key}).status_code == 204
        assert not (images_dir / key).exists()
        assert db.query(Upload).count() == 0
        assert auth_client.delete("/api/uploads", params={"key": key}).status_code == 404

    def test_cannot_delete_other_users_upload(self, auth_client, auth_client2, images_dir):
        key = _upload(auth_client)
        assert auth_client2.delete("/api/uploads", params={"key": key}).status_code == 404
        assert (images_dir / key).exists()

    def test_cannot_delete_attached_upload(self, auth_client, listing_payload, images_dir):
        key = _upload(auth_client)
        assert _create(auth_client, listing_payload, [key]).status_code == 201
        assert auth_client.delete("/api/uploads", params={"key": key}).status_code == 404
        assert (images_dir / key).exists()


class TestCreateWithImages:
    def test_images_attached_in_order(self, auth_client, listing_payload, db):
        k1, k2 = _upload(auth_client, "a.jpg"), _upload(auth_client, "b.jpg")
        resp = _create(auth_client, listing_payload, [k2, k1])
        assert resp.status_code == 201
        listing = db.query(Listing).filter(Listing.public_id == resp.json()["id"]).one()
        assert listing.images == [k2, k1]
        assert db.query(Upload).count() == 0
        detail = auth_client.get(f"/api/listings/{listing.public_id}").json()
        assert detail["thumbnail"].endswith(k2[:-4] + "_thumb.jpg")

    def test_other_users_upload_rejected(self, auth_client, auth_client2, listing_payload, db):
        key = _upload(auth_client2)
        assert _create(auth_client, listing_payload, [key]).status_code == 400
        assert db.query(Listing).count() == 0
        assert db.query(Upload).count() == 1

    def test_upload_cannot_be_attached_twice(self, auth_client, listing_payload):
        key = _upload(auth_client)
        assert _create(auth_client, listing_payload, [key]).status_code == 201
        assert _create(auth_client, listing_payload, [key]).status_code == 400

    def test_unknown_or_duplicate_key_rejected(self, auth_client, listing_payload):
        key = _upload(auth_client)
        assert _create(auth_client, listing_payload, ["uploads/x/nope.jpg"]).status_code == 400
        assert _create(auth_client, listing_payload, [key, key]).status_code == 400

    def test_more_than_ten_rejected(self, auth_client, listing_payload, db):
        keys = [_upload(auth_client) for _ in range(11)]
        assert _create(auth_client, listing_payload, keys).status_code == 400
        assert db.query(Upload).count() == 11

    def test_without_images_still_works(self, auth_client, listing_payload):
        resp = auth_client.post("/api/listings", json=listing_payload)
        assert resp.status_code == 201 and resp.json()["images"] == []


class TestPatchImages:
    @pytest.fixture()
    def listing(self, auth_client, listing_payload):
        keys = [_upload(auth_client, "a.jpg"), _upload(auth_client, "b.jpg")]
        lid = _create(auth_client, listing_payload, keys).json()["id"]
        return lid, keys

    def _patch(self, client, lid, images):
        return client.patch(f"/api/listings/{lid}", json={"images": images})

    def test_mix_existing_urls_and_new_uploads_reordered(self, auth_client, listing, db):
        lid, (k1, k2) = listing
        urls = auth_client.get(f"/api/listings/{lid}").json()["images"]
        k3 = _upload(auth_client, "c.jpg")
        resp = self._patch(auth_client, lid, [urls[1], k3, k1])
        assert resp.status_code == 200
        stored = db.query(Listing).filter(Listing.public_id == lid).one()
        db.refresh(stored)
        assert stored.images == [k2, k3, k1]
        assert db.query(Upload).count() == 0

    def test_drop_image(self, auth_client, listing, db):
        lid, (k1, _) = listing
        assert self._patch(auth_client, lid, [k1]).status_code == 200
        assert db.query(Listing).filter(Listing.public_id == lid).one().images == [k1]

    def test_other_users_upload_rejected(self, auth_client, auth_client2, listing, db):
        lid, keys = listing
        foreign = _upload(auth_client2)
        assert self._patch(auth_client, lid, keys + [foreign]).status_code == 400
        assert self._patch(auth_client, lid, ["https://evil.example/x.jpg"]).status_code == 400
        assert db.query(Listing).filter(Listing.public_id == lid).one().images == keys

    def test_more_than_ten_rejected(self, auth_client, listing):
        lid, keys = listing
        new = [_upload(auth_client) for _ in range(9)]
        assert self._patch(auth_client, lid, keys + new).status_code == 400

    def test_other_fields_leave_images_alone(self, auth_client, listing, db):
        lid, keys = listing
        assert auth_client.patch(f"/api/listings/{lid}", json={"title": "New"}).status_code == 200
        assert db.query(Listing).filter(Listing.public_id == lid).one().images == keys


class _KeepOpen:
    """The test session, shared with code that would otherwise close it."""
    def __init__(self, db):
        self._db = db

    def __getattr__(self, name):
        return getattr(self._db, name)

    def close(self):
        pass


def test_cleanup_removes_only_stale_uploads(auth_client, db, images_dir, monkeypatch):
    stale, fresh = _upload(auth_client, "old.jpg"), _upload(auth_client, "new.jpg")
    row = db.query(Upload).filter(Upload.key == stale).one()
    row.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
    db.commit()
    monkeypatch.setattr(pending_uploads, "SessionLocal", lambda: _KeepOpen(db))

    assert pending_uploads.prune_stale_uploads(get_settings()) == 1
    assert [k for (k,) in db.query(Upload.key)] == [fresh]
    assert not (images_dir / stale).exists() and (images_dir / fresh).exists()
    assert pending_uploads.prune_stale_uploads(get_settings()) == 0


def test_purge_removes_pending_uploads(auth_client, admin_client, user, db, monkeypatch):
    deleted = []
    monkeypatch.setattr("app.purge.delete_listing_image", lambda key, settings: deleted.append(key))
    key = _upload(auth_client)
    admin_client.patch(f"/api/admin/users/{user.public_id}", json={"is_active": False})
    resp = admin_client.post(f"/api/admin/users/{user.public_id}/purge", json={})
    assert resp.status_code == 200
    assert db.query(Upload).count() == 0
    assert key in deleted
