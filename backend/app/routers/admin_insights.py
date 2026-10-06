"""Admin: growth numbers (weekly activity, top listings/categories, where users come from)."""
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin import Admin
from app.models.category import Category
from app.models.favorite import Favorite
from app.models.listing import Listing, ListingStatus
from app.models.message import Conversation, Message
from app.models.user import User
from app.routers.admin_auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite drops tzinfo


@router.get("/insights")
def insights(
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
    weeks: int = Query(12, ge=4, le=52),
):
    now = datetime.now(timezone.utc)
    first_week = _monday(now.date()) - timedelta(weeks=weeks - 1)
    since = datetime.combine(first_week, datetime.min.time(), tzinfo=timezone.utc)

    # Small site: pull timestamps in the window and bucket in Python (portable across DBs).
    series = {
        "signups": db.query(User.created_at).filter(User.created_at >= since),
        "listings": db.query(Listing.created_at).filter(Listing.created_at >= since),
        "conversations": db.query(Conversation.created_at).filter(Conversation.created_at >= since),
        "messages": db.query(Message.created_at).filter(Message.created_at >= since),
    }
    buckets = {name: Counter(_monday(_as_utc(ts).date()) for (ts,) in q) for name, q in series.items()}
    week_rows = []
    for i in range(weeks):
        wk = first_week + timedelta(weeks=i)
        week_rows.append({"week": wk.isoformat(), **{name: buckets[name].get(wk, 0) for name in series}})

    def window(model, days_back: int, days_len: int = 30) -> int:
        end = now - timedelta(days=days_back)
        return db.query(func.count(model.id)).filter(model.created_at >= end - timedelta(days=days_len), model.created_at < end).scalar()

    last30 = {k: window(m, 0) for k, m in (("signups", User), ("listings", Listing), ("messages", Message))}
    prev30 = {k: window(m, 30) for k, m in (("signups", User), ("listings", Listing), ("messages", Message))}

    favs = dict(db.query(Favorite.listing_id, func.count(Favorite.id)).group_by(Favorite.listing_id))
    top_listings = [{
        "id": l.public_id, "title": l.title, "views": l.view_count or 0, "favorites": favs.get(l.id, 0),
    } for l in db.query(Listing).filter(Listing.status == ListingStatus.ACTIVE)
                    .order_by(Listing.view_count.desc().nullslast()).limit(10)]

    # Active listings per top-level category
    cats = {c.id: c for c in db.query(Category)}
    def root(cid):
        c = cats.get(cid)
        while c is not None and c.parent_id:
            c = cats.get(c.parent_id)
        return c
    per_root = Counter()
    for cid, n in db.query(Listing.category_id, func.count(Listing.id)).filter(
            Listing.status == ListingStatus.ACTIVE).group_by(Listing.category_id):
        r = root(cid)
        if r is not None:
            per_root[r.name] += n

    countries = Counter(c for (c,) in db.query(User.signup_country).filter(User.signup_country.isnot(None)))
    listing_countries = Counter(c for (c,) in db.query(Listing.created_country).filter(Listing.created_country.isnot(None)))

    return {
        "weeks": week_rows,
        "totals": {
            "users": db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar(),
            "active_listings": db.query(func.count(Listing.id)).filter(Listing.status == ListingStatus.ACTIVE).scalar(),
            "sellers": db.query(func.count(func.distinct(Listing.seller_id))).filter(Listing.status == ListingStatus.ACTIVE).scalar(),
            "conversations": db.query(func.count(Conversation.id)).scalar(),
            "views": db.query(func.coalesce(func.sum(Listing.view_count), 0)).scalar(),
        },
        "last30": last30,
        "prev30": prev30,
        "top_listings": top_listings,
        "top_categories": [{"name": n, "count": c} for n, c in per_root.most_common(8)],
        "signup_countries": [{"country": k, "count": v} for k, v in countries.most_common(8)],
        "listing_countries": [{"country": k, "count": v} for k, v in listing_countries.most_common(8)],
    }
