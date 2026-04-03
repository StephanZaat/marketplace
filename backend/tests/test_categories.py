"""Tests for /api/categories endpoints."""
import pytest
from app.models.category import Category
from app.utils import generate_public_id


# -- List categories -----------------------------------------------------------

class TestListCategories:
    def test_list_returns_categories(self, client, category):
        resp = client.get("/api/categories")
        assert resp.status_code == 200
        slugs = [c["slug"] for c in resp.json()]
        assert "electronics" in slugs

    def test_list_empty_when_no_categories(self, client):
        resp = client.get("/api/categories")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_category_has_expected_fields(self, client, category):
        resp = client.get("/api/categories")
        cat = resp.json()[0]
        assert "id" in cat
        assert "name" in cat
        assert "slug" in cat
        assert "icon" in cat


# -- Category tree -------------------------------------------------------------

class TestCategoryTree:
    def test_tree_returns_list(self, client, category):
        resp = client.get("/api/categories/tree")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_tree_includes_listing_count(self, client, category):
        resp = client.get("/api/categories/tree")
        node = resp.json()[0]
        assert "listing_count" in node
        assert "children" in node

    def test_tree_nests_children(self, client, db, category):
        child = Category(
            name="Test Gadgets",
            slug="test-gadgets-nested",
            icon="Phone",
            sort_order=0,
            parent_id=category.id,
            public_id=generate_public_id(),
        )
        db.add(child)
        db.commit()

        resp = client.get("/api/categories/tree")
        root = next(c for c in resp.json() if c["slug"] == "electronics")
        child_slugs = [ch["slug"] for ch in root["children"]]
        assert "test-gadgets-nested" in child_slugs

    def test_tree_rolls_up_listing_count(self, client, db, category, auth_client, listing_payload):
        child = Category(
            name="Test Gadgets Rollup",
            slug="test-gadgets-rollup",
            icon="Phone",
            sort_order=0,
            parent_id=category.id,
            public_id=generate_public_id(),
        )
        db.add(child)
        db.commit()
        db.refresh(child)

        # Create listing in child category
        payload = {**listing_payload, "category_id": child.public_id}
        auth_client.post("/api/listings", json=payload)

        resp = client.get("/api/categories/tree")
        root = next(c for c in resp.json() if c["slug"] == "electronics")
        assert root["listing_count"] >= 1
