"""Admin: visitor stats from the first-party page-view log."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin import Admin
from app.models.listing import Listing
from app.models.page_view import PageView
from app.routers.admin_auth import get_current_admin
from app.traffic import SITE_TZ, site_day

router = APIRouter(prefix="/admin", tags=["admin"])


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)  # SQLite drops tzinfo


def _summary(rows) -> dict:
    per_day = defaultdict(set)
    for r in rows:
        per_day[site_day(_as_utc(r.created_at))].add(r.visitor_hash)
    visitors = sum(len(v) for v in per_day.values())  # daily uniques, summed (no cross-day tracking)
    return {"visitors": visitors, "pageviews": len(rows),
            "pages_per_visitor": round(len(rows) / visitors, 1) if visitors else 0}


def _top(counter: Counter, n: int, label=lambda k: k) -> list[dict]:
    return [{"name": label(k), "count": c} for k, c in counter.most_common(n)]


@router.get("/traffic")
def traffic(
    _admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    now = datetime.now(timezone.utc)
    today = now.astimezone(SITE_TZ).date()
    first_day = today - timedelta(days=days - 1)
    start = datetime.combine(first_day, datetime.min.time(), tzinfo=SITE_TZ)
    prev_start = start - timedelta(days=days)

    cols = (PageView.created_at, PageView.path, PageView.source, PageView.country,
            PageView.device, PageView.os, PageView.visitor_hash)
    rows = db.query(*cols).filter(PageView.created_at >= start).all()
    prev = db.query(*cols).filter(PageView.created_at >= prev_start, PageView.created_at < start).all()

    daily_views, daily_visitors = Counter(), defaultdict(set)
    for r in rows:
        d = site_day(_as_utc(r.created_at))
        daily_views[d] += 1
        daily_visitors[d].add(r.visitor_hash)
    series = []
    for i in range(days):
        d = first_day + timedelta(days=i)
        series.append({"date": d.isoformat(), "visitors": len(daily_visitors[d]), "pageviews": daily_views[d]})

    page_views, page_visitors = Counter(r.path for r in rows), defaultdict(set)
    for r in rows:
        page_visitors[r.path].add((site_day(_as_utc(r.created_at)), r.visitor_hash))
    listing_ids = {p.split("/")[2] for p in page_views if p.startswith("/listings/") and p.count("/") == 2}
    titles = dict(db.query(Listing.public_id, Listing.title).filter(Listing.public_id.in_(listing_ids))) if listing_ids else {}
    top_pages = [{
        "path": p, "title": titles.get(p.split("/")[2]) if p.startswith("/listings/") and p.count("/") == 2 else None,
        "pageviews": c, "visitors": len(page_visitors[p]),
    } for p, c in page_views.most_common(15)]

    live_since = now - timedelta(minutes=30)
    live = len({r.visitor_hash for r in rows if _as_utc(r.created_at) >= live_since})

    return {
        "days": days,
        "current": _summary(rows),
        "previous": _summary(prev),
        "live": live,
        "series": series,
        "top_pages": top_pages,
        "sources": _top(Counter(r.source for r in rows), 10, lambda k: k or "Direct / unknown"),
        "countries": _top(Counter(r.country for r in rows), 10, lambda k: k or "Unknown"),
        "devices": _top(Counter(r.device for r in rows), 3),
        "os": _top(Counter(r.os for r in rows), 6, lambda k: k or "Other"),
    }
