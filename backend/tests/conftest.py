import os

# Must be set before any app imports so get_settings() picks up SQLite
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost")
# Disable rate limiting in tests
os.environ["TESTING"] = "1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, engine, get_db
from app.routers.auth import create_access_token, hash_password
from app.routers.admin_auth import hash_password as admin_hash_password, create_access_token as admin_create_token
from app.models.user import User
from app.models.admin import Admin
from app.models.category import Category
from app.utils import generate_public_id

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once for the test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    import os as _os
    if _os.path.exists("./test.db"):
        _os.remove("./test.db")


@pytest.fixture()
def db():
    """Fresh transaction per test -- rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    # Install DB override once per test; all TestClient fixtures in the same test reuse it.
    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    yield session

    session.close()
    transaction.rollback()
    connection.close()
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def client(db):
    """Unauthenticated TestClient. DB override is managed by the `db` fixture."""
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def user(db) -> User:
    """A registered user (Alice) in the test DB."""
    u = User(
        email="alice@example.com",
        hashed_password=hash_password("password123"),
        full_name="Alice Smith",
        is_active=True,
        is_verified=True,
        public_id=generate_public_id(),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def user2(db) -> User:
    """A second user (Bob) in the test DB."""
    u = User(
        email="bob@example.com",
        hashed_password=hash_password("password123"),
        full_name="Bob Jones",
        is_active=True,
        is_verified=True,
        public_id=generate_public_id(),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture()
def auth_client(db, user):
    """TestClient authenticated as Alice."""
    token = create_access_token(user.id)
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def auth_client2(db, user2):
    """TestClient authenticated as Bob."""
    token = create_access_token(user2.id)
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def admin(db) -> Admin:
    """An admin in the test DB."""
    a = Admin(username="testadmin", hashed_password=admin_hash_password("adminpass"))
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@pytest.fixture()
def admin_client(db, admin):
    """TestClient authenticated as admin."""
    token = admin_create_token({"sub": admin.username})
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture()
def category(db) -> Category:
    """A top-level category in the test DB."""
    cat = Category(name="Electronics", slug="electronics", icon="Cpu", sort_order=0, public_id=generate_public_id())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@pytest.fixture()
def listing_payload(category):
    """A valid listing creation payload."""
    return {
        "title": "iPhone 12",
        "description": "Great phone, barely used.",
        "price": "450.00",
        "is_negotiable": False,
        "condition": "good",
        "category_id": category.public_id,
        "attributes": {},
    }
