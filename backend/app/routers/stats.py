"""Public endpoint the site's tracker posts page views to (no cookies, no IP stored)."""
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.geo import country_for_ip
from app.limiter import limiter
from app.models.page_view import PageView
from app.traffic import clean_path, device_of, is_bot, os_of, site_day, source_of, visitor_hash

router = APIRouter(prefix="/stats", tags=["stats"])
settings = get_settings()


class PageViewIn(BaseModel):
    path: str = Field(max_length=2000)
    referrer: Optional[str] = Field(None, max_length=2000)
    utm_source: Optional[str] = Field(None, max_length=200)


@router.post("/pv", status_code=204)
@limiter.limit("120/minute")
def record_page_view(request: Request, data: PageViewIn, db: Session = Depends(get_db)):
    ua = request.headers.get("user-agent", "")
    path = clean_path(data.path)
    if is_bot(ua) or path.startswith("/admin"):
        return Response(status_code=204)
    ip = request.client.host if request.client else ""
    now = datetime.now(timezone.utc)
    db.add(PageView(
        created_at=now,
        path=path,
        # Own site = configured URL or whatever host this request came in on (test domains, previews).
        source=source_of(data.referrer, data.utm_source,
                         {urlparse(settings.site_url).hostname or "", request.headers.get("host", "").split(":")[0]}),
        country=country_for_ip(ip),
        device=device_of(ua),
        os=os_of(ua),
        visitor_hash=visitor_hash(settings.secret_key, ip, ua, site_day(now)),
    ))
    db.commit()
    return Response(status_code=204)
