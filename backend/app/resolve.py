from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.listing import Listing
from app.models.message import Conversation
from app.models.category import Category


def resolve_public_id(db: Session, model, public_id: str, label: str = "Resource"):
    """Look up a model instance by public_id. Raise 404 if not found."""
    obj = db.query(model).filter(model.public_id == public_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


# ── Bulk public_id lookup caches ─────────────────────────────────────────────

def _build_pid_map(db: Session, model, internal_ids: set[int]) -> dict[int, str]:
    """Given a set of internal integer IDs, return {internal_id: public_id}."""
    if not internal_ids:
        return {}
    rows = db.query(model.id, model.public_id).filter(model.id.in_(internal_ids)).all()
    return {row.id: row.public_id for row in rows}


def obj_to_dict(obj) -> dict:
    """Convert an ORM object to a dict of its column values."""
    return {c.key: getattr(obj, c.key) for c in obj.__table__.columns}


def map_listing_pids(d: dict, seller_pid_map: dict, cat_pid_map: dict) -> dict:
    """Replace internal IDs with public_ids in a listing dict."""
    d["id"] = d.pop("public_id")
    d.pop("seller_id", None)
    d["seller_id"] = seller_pid_map.get(d.get("_seller_id", 0), "")
    d.pop("category_id", None)
    d["category_id"] = cat_pid_map.get(d.get("_category_id", 0), "")
    d.pop("_seller_id", None)
    d.pop("_category_id", None)
    return d


def listing_to_public_dict(listing, db: Session) -> dict:
    """Convert a single Listing ORM to a dict with public IDs."""
    d = obj_to_dict(listing)
    d["_seller_id"] = d["seller_id"]
    d["_category_id"] = d["category_id"]
    seller_map = _build_pid_map(db, User, {d["_seller_id"]})
    cat_map = _build_pid_map(db, Category, {d["_category_id"]})
    d["id"] = d.pop("public_id")
    d["seller_id"] = seller_map.get(d.pop("_seller_id"), "")
    d["category_id"] = cat_map.get(d.pop("_category_id"), "")
    return d


def user_to_public_dict(user) -> dict:
    """Convert a User ORM to a dict with public_id as id."""
    d = obj_to_dict(user)
    d["id"] = d.pop("public_id")
    return d


def category_to_public_dict(cat, db: Session) -> dict:
    """Convert a Category ORM to a dict with public IDs."""
    d = obj_to_dict(cat)
    d["id"] = d.pop("public_id")
    if d.get("parent_id"):
        parent_map = _build_pid_map(db, Category, {d["parent_id"]})
        d["parent_id"] = parent_map.get(d["parent_id"])
    else:
        d["parent_id"] = None
    return d


def conversation_to_public_dict(conv, db: Session) -> dict:
    """Convert a Conversation ORM to a dict with public IDs."""
    d = obj_to_dict(conv)
    d["id"] = d.pop("public_id")
    # Map FK IDs
    listing_map = _build_pid_map(db, Listing, {d["listing_id"]})
    user_ids = {d["buyer_id"], d["seller_id"]}
    user_map = _build_pid_map(db, User, user_ids)
    d["listing_id"] = listing_map.get(d["listing_id"], "")
    d["buyer_id"] = user_map.get(d["buyer_id"], "")
    d["seller_id"] = user_map.get(d["seller_id"], "")
    return d


def message_to_public_dict(msg, db: Session) -> dict:
    """Convert a Message ORM to a dict with public IDs."""
    d = obj_to_dict(msg)
    conv_map = _build_pid_map(db, Conversation, {d["conversation_id"]})
    sender_map = _build_pid_map(db, User, {d["sender_id"]})
    d["conversation_id"] = conv_map.get(d["conversation_id"], "")
    d["sender_id"] = sender_map.get(d["sender_id"], "")
    return d
