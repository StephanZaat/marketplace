"""
Background scheduler for periodic tasks.

Runs a single asyncio task that wakes every hour and:
  1. Sends a 7-day expiry warning to sellers whose active listing has been
     inactive for 23 days (i.e. 7 days left before expiry).
  2. Marks listings as EXPIRED after 30 days of inactivity.
     Expired listings remain on the seller's profile until they are deleted.
  3. Once per day (around 08:00 UTC), sends each subscribed user a digest
     email of listings added in the past 24h for their watched categories.

"Inactivity" is measured from `updated_at`, so renewing a listing resets the
clock. `reminder_sent` prevents the warning email from being sent twice.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models.listing import Listing, ListingStatus

logger = logging.getLogger(__name__)

_CHECK_INTERVAL = 3600  # seconds (1 hour)
_EXPIRY_DAYS = 30
_WARNING_DAYS_BEFORE = 7  # send warning this many days before expiry
_DIGEST_HOUR = 8          # UTC hour at which daily digest is sent


async def _run_checks() -> None:
    from app import email as mail

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # ── 1. Pre-expiry warning email (23 days inactive) ────────────────────
        # Cumulative cutoff: catch all listings past the threshold that haven't
        # been warned yet, regardless of when the scheduler last ran.
        warning_threshold = now - timedelta(days=_EXPIRY_DAYS - _WARNING_DAYS_BEFORE)
        expiry_cutoff = now - timedelta(days=_EXPIRY_DAYS)

        due_for_warning = (
            db.query(Listing)
            .filter(
                Listing.status == ListingStatus.ACTIVE,
                Listing.updated_at <= warning_threshold,
                Listing.updated_at > expiry_cutoff,  # not yet expired
                Listing.reminder_sent == False,
            )
            .all()
        )

        for listing in due_for_warning:
            from app.models.user import User
            seller = db.query(User).filter(User.id == listing.seller_id).first()
            if seller:
                await mail.send_listing_expiry_warning(seller, listing)
                listing.reminder_sent = True
                db.commit()
                logger.info("Sent expiry warning for listing %d", listing.id)

        # ── 2. Expire active listings after 30 days of inactivity ─────────────
        to_expire = (
            db.query(Listing)
            .filter(
                Listing.status == ListingStatus.ACTIVE,
                Listing.updated_at <= expiry_cutoff,
            )
            .all()
        )

        for listing in to_expire:
            listing.status = ListingStatus.EXPIRED
            db.commit()
            logger.info("Expired listing %d (inactive for %d days)", listing.id, _EXPIRY_DAYS)
            from app.models.user import User
            seller = db.query(User).filter(User.id == listing.seller_id).first()
            if seller:
                await mail.send_listing_expired(seller, listing)

    except Exception:
        logger.exception("Scheduler check failed")
    finally:
        db.close()


async def _run_digest() -> None:
    """Send daily category digest emails to all subscribed users."""
    from app import email as mail
    from app.models.category_alert import CategoryAlert
    from app.models.category import Category
    from app.models.user import User

    db = SessionLocal()
    try:
        since = datetime.now(timezone.utc) - timedelta(hours=24)

        # New listings in the past 24h
        new_listings = (
            db.query(Listing)
            .filter(
                Listing.status.in_([ListingStatus.ACTIVE, ListingStatus.RESERVED]),
                Listing.created_at >= since,
            )
            .all()
        )
        if not new_listings:
            return

        # Index by category_id for fast lookup
        by_cat: dict[int, list] = {}
        for lst in new_listings:
            by_cat.setdefault(lst.category_id, []).append(lst)

        # Load all category IDs that have new listings (and their ancestors,
        # because a user subscribed to a parent should see subcategory listings)
        all_cats = {c.id: c for c in db.query(Category).all()}

        def ancestor_ids(cid: int) -> set[int]:
            """Return cid plus all ancestor IDs."""
            ids = {cid}
            cat = all_cats.get(cid)
            while cat and cat.parent_id:
                ids.add(cat.parent_id)
                cat = all_cats.get(cat.parent_id)
            return ids

        # For each listing, compute the set of category IDs it belongs to
        # (its own category + all ancestors)
        listing_ancestor_cats: dict[int, set[int]] = {
            lst.id: ancestor_ids(lst.category_id) for lst in new_listings
        }

        # All unique subscribed category IDs
        all_alerts = db.query(CategoryAlert).all()
        if not all_alerts:
            return

        # Group alerts by user
        user_alert_cats: dict[int, set[int]] = {}
        for alert in all_alerts:
            user_alert_cats.setdefault(alert.user_id, set()).add(alert.category_id)

        # Build and send digest per user
        for user_id, subscribed_cats in user_alert_cats.items():
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                continue

            # For each subscribed category, collect matching listings
            # A listing matches if the subscribed cat is in its ancestor set
            groups = []
            seen_listing_ids: set[int] = set()

            for cat_id in subscribed_cats:
                cat = all_cats.get(cat_id)
                if not cat:
                    continue
                matched = [
                    lst for lst in new_listings
                    if lst.id not in seen_listing_ids and cat_id in listing_ancestor_cats[lst.id]
                ]
                if not matched:
                    continue
                for lst in matched:
                    seen_listing_ids.add(lst.id)
                groups.append({
                    "category_name": cat.name,
                    "listings": [
                        {
                            "id": lst.public_id,
                            "title": lst.title,
                            "price": f"{lst.price:,.2f}",
                            "location": lst.location or "",
                        }
                        for lst in matched
                    ],
                })

            if groups:
                await mail.send_category_digest(user, groups)
                logger.info("Sent digest to user %d (%d groups)", user_id, len(groups))

    except Exception:
        logger.exception("Digest run failed")
    finally:
        db.close()


async def run_scheduler() -> None:
    """Infinite loop that runs listing checks every hour and digest once a day."""
    logger.info("Listing expiry scheduler started (interval=%ds)", _CHECK_INTERVAL)
    last_digest_day: int | None = None

    while True:
        await _run_checks()

        now = datetime.now(timezone.utc)
        if now.hour == _DIGEST_HOUR and now.day != last_digest_day:
            await _run_digest()
            last_digest_day = now.day
            logger.info("Daily digest sent (day=%d)", now.day)

        await asyncio.sleep(_CHECK_INTERVAL)
