"""
Admin management endpoints: listings, users, reports, stats.
All endpoints require admin authentication.
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.listing import Listing, ListingStatus
from app.models.message import Conversation, Message
from app.models.report import Report
from app.models.user import User
from app.resolve import resolve_public_id, _build_pid_map
from app.routers.admin_auth import get_current_admin
from app.models.admin import Admin

router = APIRouter(prefix="/admin", tags=["admin"])


# -- Stats -------------------------------------------------------------------

@router.get("/stats")
def get_stats(
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    return {
        "total_users": db.query(func.count(User.id)).scalar(),
        "active_users": db.query(func.count(User.id)).filter(User.is_active == True).scalar(),
        "total_listings": db.query(func.count(Listing.id)).scalar(),
        "active_listings": db.query(func.count(Listing.id)).filter(Listing.status == ListingStatus.ACTIVE).scalar(),
        "sold_listings": db.query(func.count(Listing.id)).filter(Listing.status == ListingStatus.SOLD).scalar(),
        "inactive_listings": db.query(func.count(Listing.id)).filter(Listing.status == ListingStatus.INACTIVE).scalar(),
        "total_reports": db.query(func.count(Report.id)).scalar(),
    }


# -- Listings -----------------------------------------------------------------

@router.get("/listings")
def list_listings(
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, le=100),
):
    query = db.query(Listing)
    if status:
        try:
            query = query.filter(Listing.status == ListingStatus(status))
        except ValueError:
            pass
    if q:
        query = query.filter(Listing.title.ilike(f"%{q}%"))
    total = query.count()
    listings = query.order_by(Listing.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    seller_ids = {l.seller_id for l in listings}
    seller_pid_map = _build_pid_map(db, User, seller_ids)

    result = []
    for l in listings:
        seller = db.query(User).filter(User.id == l.seller_id).first()
        result.append({
            "id": l.public_id,
            "title": l.title,
            "price": str(l.price),
            "status": l.status.value,
            "condition": l.condition.value,
            "images": l.images[:1],  # only thumbnail
            "view_count": l.view_count,
            "created_at": l.created_at.isoformat(),
            "seller_id": seller_pid_map.get(l.seller_id, ""),
            "seller_name": (seller.full_name or seller.email) if seller else None,
        })
    return {"total": total, "page": page, "items": result}


class ListingStatusUpdate(BaseModel):
    status: str


@router.patch("/listings/{listing_id}")
def update_listing_status(
    listing_id: str,
    body: ListingStatusUpdate,
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    try:
        listing.status = ListingStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    db.commit()
    return {"id": listing.public_id, "status": listing.status.value}


# -- Users -------------------------------------------------------------------

@router.get("/users")
def list_users(
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, le=100),
):
    query = db.query(User)
    if q:
        query = query.filter(
            User.full_name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        )
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for u in users:
        listing_count = db.query(func.count(Listing.id)).filter(
            Listing.seller_id == u.id,
            Listing.status != ListingStatus.INACTIVE,
        ).scalar()
        result.append({
            "id": u.public_id,
            "email": u.email,
            "full_name": u.full_name,
            "location": u.location,
            "avatar_url": u.avatar_url,
            "is_active": u.is_active,
            "is_verified": u.is_verified,
            "created_at": u.created_at.isoformat(),
            "listing_count": listing_count,
        })
    return {"total": total, "page": page, "items": result}


class UserActiveUpdate(BaseModel):
    is_active: bool


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: UserActiveUpdate,
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    user = resolve_public_id(db, User, user_id, "User")
    user.is_active = body.is_active
    db.commit()
    return {"id": user.public_id, "is_active": user.is_active}


# -- Reports -----------------------------------------------------------------

@router.get("/reports")
def list_reports(
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(25, le=100),
):
    total = db.query(func.count(Report.id)).scalar()
    reports = (
        db.query(Report)
        .order_by(Report.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    result = []
    for r in reports:
        listing = db.query(Listing).filter(Listing.id == r.listing_id).first()
        reporter = db.query(User).filter(User.id == r.reporter_id).first() if r.reporter_id else None
        result.append({
            "id": r.id,
            "reason": r.reason,
            "details": r.details,
            "created_at": r.created_at.isoformat(),
            "listing": {
                "id": listing.public_id,
                "title": listing.title,
                "status": listing.status.value,
                "images": listing.images[:1],
            } if listing else None,
            "reporter_name": (reporter.full_name or reporter.email) if reporter else None,
        })
    return {"total": total, "page": page, "items": result}


# -- Messages ----------------------------------------------------------------

@router.get("/messages")
def list_conversations(
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, le=100),
):
    query = db.query(Conversation)
    total = query.count()
    conversations = query.order_by(Conversation.updated_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for conv in conversations:
        listing = db.query(Listing).filter(Listing.id == conv.listing_id).first()
        buyer = db.query(User).filter(User.id == conv.buyer_id).first()
        seller = db.query(User).filter(User.id == conv.seller_id).first()
        message_count = db.query(func.count(Message.id)).filter(Message.conversation_id == conv.id).scalar()
        last_message = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        result.append({
            "id": conv.public_id,
            "listing": {"id": listing.public_id, "title": listing.title, "images": listing.images[:1]} if listing else None,
            "buyer_name": (buyer.full_name or buyer.email) if buyer else None,
            "seller_name": (seller.full_name or seller.email) if seller else None,
            "message_count": message_count,
            "last_message": last_message.body[:120] if last_message else None,
            "updated_at": conv.updated_at.isoformat(),
        })

    # Apply search filter after build (simple approach)
    if q:
        ql = q.lower()
        result = [r for r in result if
            (r["buyer_name"] and ql in r["buyer_name"].lower()) or
            (r["seller_name"] and ql in r["seller_name"].lower()) or
            (r["listing"] and ql in r["listing"]["title"].lower())
        ]

    return {"total": total, "page": page, "items": result}


@router.get("/messages/{conversation_id}")
def get_conversation_messages(
    conversation_id: str,
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    conv = resolve_public_id(db, Conversation, conversation_id, "Conversation")

    messages = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at).all()
    result = []
    for m in messages:
        sender = db.query(User).filter(User.id == m.sender_id).first()
        result.append({
            "id": m.id,
            "body": m.body,
            "sender_name": (sender.full_name or sender.email) if sender else None,
            "is_read": m.is_read,
            "created_at": m.created_at.isoformat(),
        })
    return result


@router.delete("/reports/{report_id}")
def dismiss_report(
    report_id: int,
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"detail": "Report dismissed"}


@router.post("/reports/{report_id}/action")
def action_report(
    report_id: int,
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    """Deactivate the reported listing and dismiss the report."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    listing = db.query(Listing).filter(Listing.id == report.listing_id).first()
    if listing:
        listing.status = ListingStatus.INACTIVE
    db.delete(report)
    db.commit()
    return {"detail": "Listing deactivated and report dismissed"}
