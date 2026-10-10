from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class PageView(Base):
    """One anonymous page view. No IP or cookie: visitor_hash changes daily."""
    __tablename__ = "page_views"

    id = Column(Integer, primary_key=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    path = Column(String(300), nullable=False)
    source = Column(String(100), nullable=True)   # referrer host or utm_source; None = direct
    country = Column(String(2), nullable=True)
    device = Column(String(10), nullable=False)    # mobile | tablet | desktop
    os = Column(String(20), nullable=True)
    visitor_hash = Column(String(16), nullable=False, index=True)
