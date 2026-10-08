"""Permanently remove a suspended user and everything they created."""
import logging

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.blocked_email import BlockedEmail
from app.models.category_alert import CategoryAlert
from app.models.favorite import Favorite
from app.models.listing import Listing
from app.models.message import Conversation, Message
from app.models.rating import Rating
from app.models.report import Report
from app.models.user import User
from app.storage import delete_listing_image

logger = logging.getLogger(__name__)


def purge_user(db: Session, user: User, reason: str | None = None) -> dict:
    """Delete the user's listings, photos, conversations, favorites, ratings and
    alerts, then the user, and block their email from signing up again.

    Database rows go in one transaction; photos are removed from storage only
    after it commits (best effort; a failed delete leaves an orphaned file,
    never a dangling row).
    """
    listing_ids = [lid for (lid,) in db.query(Listing.id).filter(Listing.seller_id == user.id)]
    images = [img for (imgs,) in db.query(Listing.images).filter(Listing.seller_id == user.id) for img in (imgs or [])]
    if user.avatar_url:
        images.append(user.avatar_url)

    conv_ids = [cid for (cid,) in db.query(Conversation.id).filter(or_(
        Conversation.buyer_id == user.id,
        Conversation.seller_id == user.id,
        Conversation.listing_id.in_(listing_ids),
    ))]

    counts = {
        "listings": len(listing_ids),
        "conversations": len(conv_ids),
        "images": len(images),
    }
    db.query(Message).filter(Message.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
    db.query(Conversation).filter(Conversation.id.in_(conv_ids)).delete(synchronize_session=False)
    db.query(Favorite).filter(or_(Favorite.user_id == user.id, Favorite.listing_id.in_(listing_ids))).delete(synchronize_session=False)
    db.query(Rating).filter(or_(
        Rating.rater_id == user.id, Rating.ratee_id == user.id, Rating.listing_id.in_(listing_ids),
    )).delete(synchronize_session=False)
    db.query(Report).filter(Report.listing_id.in_(listing_ids)).delete(synchronize_session=False)
    db.query(Report).filter(Report.reporter_id == user.id).update({Report.reporter_id: None}, synchronize_session=False)
    db.query(CategoryAlert).filter(CategoryAlert.user_id == user.id).delete(synchronize_session=False)
    db.query(Listing).filter(Listing.id.in_(listing_ids)).delete(synchronize_session=False)

    email = user.email.strip().lower()
    # A case-twin account (legacy data) still uses this address: don't lock it out.
    shared = db.query(User.id).filter(func.lower(User.email) == email, User.id != user.id).first()
    if not shared and not db.query(BlockedEmail.id).filter(BlockedEmail.email == email).first():
        db.add(BlockedEmail(email=email, reason=(reason or "purged by admin")[:200]))
    db.delete(user)
    db.commit()

    # Never delete a file another listing still points at (seed data shares
    # catalog images). Small site, so a full scan is fine.
    still_used = {img for (imgs,) in db.query(Listing.images) for img in (imgs or [])}
    images = [k for k in images if k not in still_used]
    counts["images"] = len(images)

    settings = get_settings()
    for key in images:
        try:
            delete_listing_image(key, settings)
        except Exception:
            logger.warning("Purge: could not delete image %s", key, exc_info=True)
    logger.info("Purged user %s: %s", email, counts)
    return counts
