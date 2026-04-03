"""Tests for /api/ratings endpoints."""
import pytest
from app.models.listing import Listing, ListingStatus
from app.models.message import Conversation


# -- Helpers -------------------------------------------------------------------

@pytest.fixture()
def created_listing(auth_client, listing_payload):
    resp = auth_client.post("/api/listings", json=listing_payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def sold_listing_with_conversation(auth_client, auth_client2, created_listing, db):
    """
    Bob starts a conversation, Alice marks the listing as sold,
    and the conversation is marked as the buyer (is_sold_to=True).
    Returns (listing_data, conversation).
    """
    # Bob starts conversation
    resp = auth_client2.post(
        f"/api/messages/start/{created_listing['id']}",
        json={"body": "I want to buy this"},
    )
    assert resp.status_code == 201
    conv_data = resp.json()

    # Mark listing as sold
    auth_client.patch(f"/api/listings/{created_listing['id']}", json={"status": "sold"})

    # Mark conversation as sold_to
    conv = db.query(Conversation).filter(Conversation.public_id == conv_data["id"]).first()
    conv.is_sold_to = True
    db.commit()

    return created_listing, conv_data


# -- Submit rating -------------------------------------------------------------

class TestSubmitRating:
    def test_buyer_rates_seller(self, auth_client2, user, user2, sold_listing_with_conversation):
        listing_data, conv_data = sold_listing_with_conversation
        resp = auth_client2.post("/api/ratings", json={
            "listing_id": listing_data["id"],
            "ratee_id": user.public_id,
            "role": "buyer_rating_seller",
            "score_description": 5,
            "score_communication": 4,
            "score_exchange": 5,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["rater_id"] == user2.public_id
        assert data["ratee_id"] == user.public_id
        assert data["score_description"] == 5

    def test_seller_rates_buyer(self, auth_client, user, user2, sold_listing_with_conversation):
        listing_data, conv_data = sold_listing_with_conversation
        resp = auth_client.post("/api/ratings", json={
            "listing_id": listing_data["id"],
            "ratee_id": user2.public_id,
            "role": "seller_rating_buyer",
            "score_overall": 4,
        })
        assert resp.status_code == 201
        assert resp.json()["score_overall"] == 4

    def test_rating_requires_auth(self, client, sold_listing_with_conversation):
        listing_data, _ = sold_listing_with_conversation
        resp = client.post("/api/ratings", json={
            "listing_id": listing_data["id"],
            "ratee_id": "xxx",
            "role": "buyer_rating_seller",
            "score_description": 5,
            "score_communication": 4,
            "score_exchange": 5,
        })
        assert resp.status_code == 401

    def test_cannot_rate_without_conversation(self, auth_client2, user, created_listing):
        """No conversation means no transaction -- should be 403."""
        # Mark listing as sold without a conversation from this user
        resp = auth_client2.post("/api/ratings", json={
            "listing_id": created_listing["id"],
            "ratee_id": user.public_id,
            "role": "buyer_rating_seller",
            "score_description": 5,
            "score_communication": 4,
            "score_exchange": 5,
        })
        # Listing isn't sold yet, so 404
        assert resp.status_code == 404

    def test_wrong_role_returns_403(self, auth_client, user2, sold_listing_with_conversation):
        """Alice (seller) tries to submit a buyer_rating_seller -- wrong role."""
        listing_data, _ = sold_listing_with_conversation
        resp = auth_client.post("/api/ratings", json={
            "listing_id": listing_data["id"],
            "ratee_id": user2.public_id,
            "role": "buyer_rating_seller",
            "score_description": 5,
            "score_communication": 4,
            "score_exchange": 5,
        })
        assert resp.status_code == 403


# -- Get user ratings ----------------------------------------------------------

class TestGetUserRatings:
    def test_get_user_rating_stats_empty(self, client, user):
        resp = client.get(f"/api/ratings/user/{user.public_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["as_seller"]["count"] == 0
        assert data["as_buyer"]["count"] == 0

    def test_get_user_rating_stats_after_rating(self, client, auth_client2, user, sold_listing_with_conversation):
        listing_data, _ = sold_listing_with_conversation
        # Bob rates Alice as seller
        auth_client2.post("/api/ratings", json={
            "listing_id": listing_data["id"],
            "ratee_id": user.public_id,
            "role": "buyer_rating_seller",
            "score_description": 4,
            "score_communication": 5,
            "score_exchange": 3,
        })
        resp = client.get(f"/api/ratings/user/{user.public_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["as_seller"]["count"] == 1
        assert data["as_seller"]["avg_description"] == 4.0

    def test_get_nonexistent_user_returns_404(self, client):
        resp = client.get("/api/ratings/user/zzzzzzzzzz")
        assert resp.status_code == 404


# -- Pending ratings -----------------------------------------------------------

class TestPendingRatings:
    def test_pending_returns_unrated(self, auth_client2, sold_listing_with_conversation):
        resp = auth_client2.get("/api/ratings/pending")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
        assert resp.json()[0]["role"] == "buyer_rating_seller"

    def test_pending_empty_after_rating(self, auth_client2, user, sold_listing_with_conversation):
        listing_data, _ = sold_listing_with_conversation
        auth_client2.post("/api/ratings", json={
            "listing_id": listing_data["id"],
            "ratee_id": user.public_id,
            "role": "buyer_rating_seller",
            "score_description": 5,
            "score_communication": 5,
            "score_exchange": 5,
        })
        resp = auth_client2.get("/api/ratings/pending")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    def test_pending_requires_auth(self, client):
        resp = client.get("/api/ratings/pending")
        assert resp.status_code == 401
