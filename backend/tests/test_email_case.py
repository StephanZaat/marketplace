"""Emails are case-insensitive: Foo@x.com and foo@x.com are one account."""
import os

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.main import normalize_emails_on
from app.models.user import User
from app.routers.auth import _create_otp_token


@pytest.fixture(autouse=True)
def dev_otp():
    os.environ["DEV_OTP_CODE"] = "123456"
    yield
    os.environ.pop("DEV_OTP_CODE", None)


def _login(client, email):
    return client.post("/api/auth/otp-verify", json={
        "email": email, "code": "123456", "otp_token": _create_otp_token(email.strip().lower(), "123456"),
    })


@pytest.fixture()
def allow_case_twins(db):
    """Legacy data predates the lower(email) index; on Postgres drop it inside
    the test transaction (DDL is transactional there and rolls back)."""
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("DROP INDEX IF EXISTS ix_users_email_lower"))


def _me(client, token):
    return client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()


def test_mixed_case_login_finds_existing_account(client, user, db):
    resp = _login(client, user.email.upper())
    assert resp.status_code == 200
    assert _me(client, resp.json()["access_token"])["id"] == user.public_id
    assert db.query(User).count() == 1


def test_new_account_stored_lower_case(client, db):
    assert _login(client, "  New.Person@Example.COM ").status_code == 200
    assert db.query(User).filter(User.email == "new.person@example.com").count() == 1


def test_otp_send_sees_existing_account_case_insensitively(client, user):
    resp = client.post("/api/auth/otp-send", json={"email": user.email.upper()})
    assert resp.json()["is_new_user"] is False


def test_active_account_wins_over_suspended_case_twin(client, db, allow_case_twins):
    twin = User(email="Twin@example.com", full_name="old", is_verified=True, is_active=False)
    real = User(email="twin@example.com", full_name="real", is_verified=True, is_active=True)
    db.add_all([twin, real])
    db.commit()
    resp = _login(client, "TWIN@example.com")
    assert resp.status_code == 200
    assert _me(client, resp.json()["access_token"])["id"] == real.public_id


def test_migration_lowercases_only_without_collision(db, allow_case_twins):
    db.add_all([
        User(email="Solo@Example.com", is_verified=True),
        User(email="Dup@example.com", is_verified=True),
        User(email="dup@example.com", is_verified=True),
    ])
    db.commit()
    changed, dupes = normalize_emails_on(db.connection(), is_postgres=False)
    assert (changed, dupes) == (1, ["dup@example.com"])
    db.expire_all()
    emails = {e for (e,) in db.query(User.email).filter(User.email.ilike("%example.com"))}
    assert emails == {"solo@example.com", "Dup@example.com", "dup@example.com"}


def test_postgres_rejects_case_twin(db):
    if db.get_bind().dialect.name != "postgresql":
        pytest.skip("lower(email) unique index is Postgres-only")
    db.add(User(email="dupe@example.com", is_verified=True))
    db.flush()
    db.add(User(email="Dupe@Example.com", is_verified=True))
    with pytest.raises(IntegrityError):
        db.flush()


def test_purging_case_twin_does_not_block_the_real_account(admin_client, db, allow_case_twins):
    twin = User(email="Owner@example.com", is_verified=True, is_active=False)
    real = User(email="owner@example.com", is_verified=True, is_active=True)
    db.add_all([twin, real])
    db.commit()
    assert admin_client.post(f"/api/admin/users/{twin.public_id}/purge", json={}).status_code == 200
    from app.models.blocked_email import BlockedEmail
    assert db.query(BlockedEmail).filter(BlockedEmail.email == "owner@example.com").count() == 0
