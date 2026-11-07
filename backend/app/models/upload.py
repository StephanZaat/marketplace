from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.database import Base


class Upload(Base):
    """A photo uploaded ahead of listing create/edit. The row exists only while the
    photo is unattached: claiming it for a listing deletes the row."""
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True)
    key = Column(String(300), unique=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
