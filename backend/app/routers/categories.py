from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category import Category
from app.models.listing import Listing, ListingStatus
from app.resolve import category_to_public_dict, _build_pid_map
from app.schemas.category import CategoryOut, CategoryTree

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    all_cats = db.query(Category).order_by(Category.sort_order, Category.name).all()
    # Build parent_id -> public_id map
    parent_ids = {c.parent_id for c in all_cats if c.parent_id}
    parent_pid_map = _build_pid_map(db, Category, parent_ids) if parent_ids else {}
    result = []
    for cat in all_cats:
        d = {c.key: getattr(cat, c.key) for c in cat.__table__.columns}
        d["id"] = d.pop("public_id")
        d["parent_id"] = parent_pid_map.get(d["parent_id"]) if d.get("parent_id") else None
        result.append(d)
    return result


@router.get("/tree", response_model=List[CategoryTree])
def category_tree(db: Session = Depends(get_db)):
    all_cats = db.query(Category).order_by(Category.sort_order, Category.name).all()

    # Count active listings per category_id
    rows = (
        db.query(Listing.category_id, func.count(Listing.id))
        .filter(Listing.status == ListingStatus.ACTIVE)
        .group_by(Listing.category_id)
        .all()
    )
    counts: dict[int, int] = {cat_id: cnt for cat_id, cnt in rows}

    # Build parent_id -> public_id map
    parent_ids = {c.parent_id for c in all_cats if c.parent_id}
    parent_pid_map = _build_pid_map(db, Category, parent_ids) if parent_ids else {}

    # Convert to dicts with public IDs
    by_internal_id: dict[int, dict] = {}
    for cat in all_cats:
        d = {c.key: getattr(cat, c.key) for c in cat.__table__.columns}
        d["id"] = d.pop("public_id")
        d["_internal_id"] = cat.id
        d["_internal_parent_id"] = cat.parent_id
        d["parent_id"] = parent_pid_map.get(cat.parent_id) if cat.parent_id else None
        d["children"] = []
        d["listing_count"] = counts.get(cat.id, 0)
        by_internal_id[cat.id] = d

    roots = []
    for d in by_internal_id.values():
        if d["_internal_parent_id"] is None:
            roots.append(d)
        else:
            parent = by_internal_id.get(d["_internal_parent_id"])
            if parent:
                parent["children"].append(d)

    # Roll up counts to parents (top-level shows total across entire subtree)
    def rollup(node: dict) -> int:
        total = node["listing_count"]
        for child in node["children"]:
            total += rollup(child)
        node["listing_count"] = total
        return total

    for root in roots:
        rollup(root)

    # Clean up internal fields
    def clean(node: dict):
        node.pop("_internal_id", None)
        node.pop("_internal_parent_id", None)
        for child in node.get("children", []):
            clean(child)

    for root in roots:
        clean(root)

    return roots
