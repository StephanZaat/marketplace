"""Admin: per-user detail, notes/trust, purge, and the blocked-email list."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.admin import Admin
from app.models.blocked_email import BlockedEmail
from app.models.category import Category
from app.models.listing import Listing
from app.models.message import Conversation, Message
from app.models.rating import Rating
from app.models.report import Report
from app.models.user import User
from app.purge import purge_user
from app.resolve import resolve_public_id
from app.routers.admin_auth import get_current_admin
from app.storage import resolve_image_url

router = APIRouter(prefix="/admin", tags=["admin"])
AdminDep = Annotated[Admin, Depends(get_current_admin)]


@router.get("/users/{user_id}")
def user_detail(user_id: str, _admin: AdminDep, db: Session = Depends(get_db)):
    user = resolve_public_id(db, User, user_id, "User")
    settings = get_settings()
    cats = {c.id: c.name for c in db.query(Category.id, Category.name)}

    listings = db.query(Listing).filter(Listing.seller_id == user.id).order_by(Listing.created_at.desc()).all()
    listing_ids = [l.id for l in listings]

    convs = (
        db.query(Conversation)
        .filter(or_(Conversation.buyer_id == user.id, Conversation.seller_id == user.id))
        .order_by(Conversation.updated_at.desc())
        .limit(50)
        .all()
    )
    titles = {l.id: l.title for l in db.query(Listing.id, Listing.title).filter(Listing.id.in_({c.listing_id for c in convs}))}
    others = {u.id: (u.full_name or u.email) for u in db.query(User.id, User.full_name, User.email).filter(
        User.id.in_({c.buyer_id for c in convs} | {c.seller_id for c in convs}))}
    msg_counts = dict(db.query(Message.conversation_id, func.count(Message.id))
                      .filter(Message.conversation_id.in_([c.id for c in convs]))
                      .group_by(Message.conversation_id))

    avg, n = db.query(func.avg(Rating.score_overall), func.count(Rating.id)).filter(Rating.ratee_id == user.id).one()
    report_count = db.query(func.count(Report.id)).filter(Report.listing_id.in_(listing_ids)).scalar()

    return {
        "id": user.public_id,
        "email": user.email,
        "full_name": user.full_name,
        "location": user.location,
        "phone": user.phone,
        "whatsapp": user.whatsapp,
        "avatar_url": resolve_image_url(user.avatar_url, settings),
        "is_active": user.is_active,
        "is_trusted": user.is_trusted,
        "signup_country": user.signup_country,
        "admin_note": user.admin_note,
        "created_at": user.created_at.isoformat(),
        "rating_avg": round(float(avg), 1) if avg is not None else None,
        "rating_count": n,
        "reports_against": report_count,
        "listings": [{
            "id": l.public_id,
            "title": l.title,
            "price": str(l.price),
            "status": l.status.value,
            "category": cats.get(l.category_id),
            "created_country": l.created_country,
            "view_count": l.view_count,
            "image": resolve_image_url(l.images[0], settings) if l.images else None,
            "created_at": l.created_at.isoformat(),
        } for l in listings],
        "conversations": [{
            "id": c.public_id,
            "listing_title": titles.get(c.listing_id),
            "role": "buyer" if c.buyer_id == user.id else "seller",
            "other_party": others.get(c.seller_id if c.buyer_id == user.id else c.buyer_id),
            "message_count": msg_counts.get(c.id, 0),
            "updated_at": c.updated_at.isoformat(),
        } for c in convs],
    }


class UserMetaUpdate(BaseModel):
    admin_note: Optional[str] = Field(None, max_length=5000)
    is_trusted: Optional[bool] = None


@router.patch("/users/{user_id}/meta")
def update_user_meta(user_id: str, body: UserMetaUpdate, _admin: AdminDep, db: Session = Depends(get_db)):
    user = resolve_public_id(db, User, user_id, "User")
    if body.admin_note is not None:
        user.admin_note = body.admin_note.strip() or None
    if body.is_trusted is not None:
        user.is_trusted = body.is_trusted
    db.commit()
    return {"id": user.public_id, "admin_note": user.admin_note, "is_trusted": user.is_trusted}


class PurgeRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=200)


@router.post("/users/purge-suspended")
def purge_all_suspended(body: PurgeRequest, _admin: AdminDep, db: Session = Depends(get_db)):
    """Purge every suspended account."""
    users = db.query(User).filter(User.is_active == False).all()  # noqa: E712
    totals = {"users": 0, "listings": 0, "conversations": 0, "images": 0}
    for user in users:
        for k, v in purge_user(db, user, body.reason).items():
            totals[k] += v
        totals["users"] += 1
    return totals


@router.post("/users/{user_id}/purge")
def purge_one(user_id: str, body: PurgeRequest, _admin: AdminDep, db: Session = Depends(get_db)):
    user = resolve_public_id(db, User, user_id, "User")
    if user.is_active:
        # Two-step on purpose: suspend first, purge second.
        raise HTTPException(status_code=400, detail="Suspend the user before purging")
    return purge_user(db, user, body.reason)


@router.get("/blocked-emails")
def list_blocked(_admin: AdminDep, db: Session = Depends(get_db)):
    rows = db.query(BlockedEmail).order_by(BlockedEmail.created_at.desc()).all()
    return [{"id": b.id, "email": b.email, "reason": b.reason, "created_at": b.created_at.isoformat()} for b in rows]


@router.delete("/blocked-emails/{blocked_id}", status_code=204)
def unblock(blocked_id: int, _admin: AdminDep, db: Session = Depends(get_db)):
    row = db.query(BlockedEmail).filter(BlockedEmail.id == blocked_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
