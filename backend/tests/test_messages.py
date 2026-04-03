"""Tests for /api/messages endpoints."""
import pytest
from app.models.message import Conversation, Message


# -- Helpers -------------------------------------------------------------------

@pytest.fixture()
def created_listing(auth_client, listing_payload):
    """Creates a listing as Alice and returns the response JSON."""
    resp = auth_client.post("/api/listings", json=listing_payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def conversation(auth_client2, created_listing):
    """Bob starts a conversation on Alice's listing."""
    resp = auth_client2.post(
        f"/api/messages/start/{created_listing['id']}",
        json={"body": "Is this still available?"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# -- Start conversation --------------------------------------------------------

class TestStartConversation:
    def test_start_creates_conversation(self, auth_client2, created_listing):
        resp = auth_client2.post(
            f"/api/messages/start/{created_listing['id']}",
            json={"body": "Hello!"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["listing"]["id"] == created_listing["id"]
        assert len(data["messages"]) == 1
        assert data["messages"][0]["body"] == "Hello!"

    def test_cannot_message_own_listing(self, auth_client, created_listing):
        resp = auth_client.post(
            f"/api/messages/start/{created_listing['id']}",
            json={"body": "Talking to myself?"},
        )
        assert resp.status_code == 400

    def test_start_requires_auth(self, client, created_listing):
        resp = client.post(
            f"/api/messages/start/{created_listing['id']}",
            json={"body": "Hi"},
        )
        assert resp.status_code == 401

    def test_start_nonexistent_listing_returns_404(self, auth_client2):
        resp = auth_client2.post(
            "/api/messages/start/zzzzzzzzzz",
            json={"body": "Hi"},
        )
        assert resp.status_code == 404

    def test_start_reuses_existing_conversation(self, auth_client2, created_listing):
        resp1 = auth_client2.post(
            f"/api/messages/start/{created_listing['id']}",
            json={"body": "First"},
        )
        resp2 = auth_client2.post(
            f"/api/messages/start/{created_listing['id']}",
            json={"body": "Second"},
        )
        assert resp1.json()["id"] == resp2.json()["id"]
        assert len(resp2.json()["messages"]) == 2


# -- List conversations --------------------------------------------------------

class TestListConversations:
    def test_list_returns_conversations(self, auth_client2, conversation):
        resp = auth_client2.get("/api/messages")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()]
        assert conversation["id"] in ids

    def test_seller_sees_conversation(self, auth_client, conversation):
        resp = auth_client.get("/api/messages")
        assert resp.status_code == 200
        ids = [c["id"] for c in resp.json()]
        assert conversation["id"] in ids

    def test_list_requires_auth(self, client):
        resp = client.get("/api/messages")
        assert resp.status_code == 401

    def test_list_empty_for_unrelated_user(self, auth_client, db):
        # auth_client (Alice) with no conversations
        resp = auth_client.get("/api/messages")
        assert resp.status_code == 200
        assert resp.json() == []


# -- Get conversation detail ---------------------------------------------------

class TestGetConversation:
    def test_get_returns_detail(self, auth_client2, conversation):
        resp = auth_client2.get(f"/api/messages/{conversation['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == conversation["id"]
        assert "messages" in data
        assert "listing" in data

    def test_get_requires_auth(self, client, conversation):
        resp = client.get(f"/api/messages/{conversation['id']}")
        assert resp.status_code == 401

    def test_non_participant_gets_403(self, client, db, conversation):
        """A third user cannot access the conversation."""
        from app.routers.auth import create_access_token, hash_password
        from app.models.user import User
        from app.utils import generate_public_id
        from fastapi.testclient import TestClient
        from app.main import app

        u3 = User(
            email="charlie@example.com",
            hashed_password=hash_password("password123"),
            full_name="Charlie",
            is_active=True,
            is_verified=True,
            public_id=generate_public_id(),
        )
        db.add(u3)
        db.commit()
        db.refresh(u3)
        token = create_access_token(u3.id)
        with TestClient(app, headers={"Authorization": f"Bearer {token}"}, raise_server_exceptions=False) as c3:
            resp = c3.get(f"/api/messages/{conversation['id']}")
            assert resp.status_code == 403

    def test_get_nonexistent_returns_404(self, auth_client):
        resp = auth_client.get("/api/messages/zzzzzzzzzz")
        assert resp.status_code == 404


# -- Send message --------------------------------------------------------------

class TestSendMessage:
    def test_send_message(self, auth_client, conversation):
        resp = auth_client.post(
            f"/api/messages/{conversation['id']}",
            json={"body": "Yes, it is!"},
        )
        assert resp.status_code == 201
        assert resp.json()["body"] == "Yes, it is!"

    def test_send_requires_auth(self, client, conversation):
        resp = client.post(
            f"/api/messages/{conversation['id']}",
            json={"body": "Anonymous"},
        )
        assert resp.status_code == 401

    def test_non_participant_cannot_send(self, client, db, conversation):
        from app.routers.auth import create_access_token, hash_password
        from app.models.user import User
        from app.utils import generate_public_id
        from fastapi.testclient import TestClient
        from app.main import app

        u3 = User(
            email="dave@example.com",
            hashed_password=hash_password("password123"),
            full_name="Dave",
            is_active=True,
            is_verified=True,
            public_id=generate_public_id(),
        )
        db.add(u3)
        db.commit()
        db.refresh(u3)
        token = create_access_token(u3.id)
        with TestClient(app, headers={"Authorization": f"Bearer {token}"}, raise_server_exceptions=False) as c3:
            resp = c3.post(
                f"/api/messages/{conversation['id']}",
                json={"body": "Intruder!"},
            )
            assert resp.status_code == 403


# -- Unread count --------------------------------------------------------------

class TestUnreadCount:
    def test_unread_count_for_seller(self, auth_client, conversation):
        resp = auth_client.get("/api/messages/unread")
        assert resp.status_code == 200
        assert resp.json()["count"] >= 1

    def test_unread_count_zero_for_sender(self, auth_client2, conversation):
        resp = auth_client2.get("/api/messages/unread")
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_unread_requires_auth(self, client):
        resp = client.get("/api/messages/unread")
        assert resp.status_code == 401

    def test_reading_conversation_clears_unread(self, auth_client, conversation):
        # Alice reads the conversation
        auth_client.get(f"/api/messages/{conversation['id']}")
        resp = auth_client.get("/api/messages/unread")
        assert resp.json()["count"] == 0
