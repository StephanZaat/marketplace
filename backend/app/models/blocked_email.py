from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from app.database import Base


class BlockedEmail(Base):
    """Emails of purged accounts; they can't sign up again."""
    __tablename__ = "blocked_emails"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)  # stored lower-case
    reason = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


def is_email_blocked(db, email: str) -> bool:
    return db.query(BlockedEmail.id).filter(BlockedEmail.email == email.strip().lower()).first() is not None
