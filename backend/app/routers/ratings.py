from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.message import Conversation
from app.models.listing import Listing, ListingStatus
from app.models.rating import Rating
from app.models.user import User
from app.resolve import resolve_public_id, _build_pid_map
from app.routers.auth import get_current_user
from app.schemas.rating import RatingCreate, RatingOut, PendingRating, UserRatingStats, SellerStats, BuyerStats

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.get("/pending", response_model=List[PendingRating])
def get_pending_ratings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return conversations where the listing is SOLD and the current user hasn't rated yet."""
    uid = current_user.id

    # All conversations where current user is buyer or seller, listing is sold
    convs = (
        db.query(Conversation)
        .join(Listing, Listing.id == Conversation.listing_id)
        .filter(
            Listing.status == ListingStatus.SOLD,
            Conversation.is_sold_to == True,
            (Conversation.buyer_id == uid) | (Conversation.seller_id == uid),
        )
        .all()
    )

    # IDs of listings already rated by this user
    already_rated = {
        r.listing_id
        for r in db.query(Rating.listing_id).filter(Rating.rater_id == uid).all()
    }

    pending = []
    for conv in convs:
        if conv.listing_id in already_rated:
            continue
        listing = db.query(Listing).filter(Listing.id == conv.listing_id).first()
        if not listing:
            continue

        if conv.buyer_id == uid:
            role = "buyer_rating_seller"
            other_user_id = conv.seller_id
        else:
            role = "seller_rating_buyer"
            other_user_id = conv.buyer_id

        other_user = db.query(User).filter(User.id == other_user_id).first()
        # Resolve public IDs
        user_pid_map = _build_pid_map(db, User, {other_user_id})
        listing_pid = listing.public_id

        pending.append(PendingRating(
            conversation_id=conv.public_id,
            listing_id=listing_pid,
            listing_title=listing.title,
            other_user_id=user_pid_map.get(other_user_id, ""),
            other_user_name=other_user.full_name if other_user else None,
            role=role,
        ))

    return pending


@router.post("", response_model=RatingOut, status_code=201)
def submit_rating(
    data: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id

    # Resolve public IDs
    listing = resolve_public_id(db, Listing, data.listing_id, "Listing")
    if listing.status != ListingStatus.SOLD:
        raise HTTPException(status_code=404, detail="Listing not found or not sold")

    ratee = resolve_public_id(db, User, data.ratee_id, "User")

    # Verify current user was part of a conversation about this listing
    conv = db.query(Conversation).filter(
        Conversation.listing_id == listing.id,
        Conversation.is_sold_to == True,
        (Conversation.buyer_id == uid) | (Conversation.seller_id == uid),
    ).first()
    if not conv:
        raise HTTPException(status_code=403, detail="You were not part of this transaction")

    # Verify role matches actual relationship
    if data.role == "buyer_rating_seller" and conv.buyer_id != uid:
        raise HTTPException(status_code=403, detail="Only the buyer can submit a buyer rating")
    if data.role == "seller_rating_buyer" and conv.seller_id != uid:
        raise HTTPException(status_code=403, detail="Only the seller can submit a seller rating")

    # Verify ratee matches
    expected_ratee_id = conv.seller_id if data.role == "buyer_rating_seller" else conv.buyer_id
    if ratee.id != expected_ratee_id:
        raise HTTPException(status_code=400, detail="Ratee mismatch")

    rating = Rating(
        listing_id=listing.id,
        rater_id=uid,
        ratee_id=ratee.id,
        role=data.role,
        score_description=data.score_description,
        score_communication=data.score_communication,
        score_exchange=data.score_exchange,
        score_overall=data.score_overall,
    )
    db.add(rating)
    try:
        db.commit()
        db.refresh(rating)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Already rated")

    # Build response with public IDs
    d = {c.key: getattr(rating, c.key) for c in rating.__table__.columns}
    listing_pid_map = _build_pid_map(db, Listing, {rating.listing_id})
    user_pid_map = _build_pid_map(db, User, {rating.rater_id, rating.ratee_id})
    d["listing_id"] = listing_pid_map.get(rating.listing_id, "")
    d["rater_id"] = user_pid_map.get(rating.rater_id, "")
    d["ratee_id"] = user_pid_map.get(rating.ratee_id, "")
    return d


@router.get("/user/{user_id}", response_model=UserRatingStats)
def get_user_rating_stats(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.public_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    internal_id = user.id

    # Seller stats (ratings received as seller)
    seller_rows = db.query(Rating).filter(
        Rating.ratee_id == internal_id,
        Rating.role == "buyer_rating_seller",
    ).all()

    as_seller = SellerStats(count=len(seller_rows))
    if seller_rows:
        as_seller.avg_description = round(
            sum(r.score_description for r in seller_rows) / len(seller_rows), 1
        )
        as_seller.avg_communication = round(
            sum(r.score_communication for r in seller_rows) / len(seller_rows), 1
        )
        as_seller.avg_exchange = round(
            sum(r.score_exchange for r in seller_rows) / len(seller_rows), 1
        )
        as_seller.avg_overall = round(
            sum((r.score_description + r.score_communication + r.score_exchange) / 3.0 for r in seller_rows)
            / len(seller_rows), 1
        )

    # Buyer stats (ratings received as buyer)
    buyer_rows = db.query(Rating).filter(
        Rating.ratee_id == internal_id,
        Rating.role == "seller_rating_buyer",
    ).all()

    as_buyer = BuyerStats(count=len(buyer_rows))
    if buyer_rows:
        as_buyer.avg_overall = round(
            sum(r.score_overall for r in buyer_rows) / len(buyer_rows), 1
        )

    return UserRatingStats(as_seller=as_seller, as_buyer=as_buyer)
