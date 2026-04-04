import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Boolean,
    DateTime, Enum as SAEnum, ForeignKey, JSON
)
from app.database import Base
from app.utils import generate_public_id


class ListingStatus(str, enum.Enum):
    ACTIVE = "active"
    SOLD = "sold"
    RESERVED = "reserved"
    INACTIVE = "inactive"
    EXPIRED = "expired"


class ListingCondition(str, enum.Enum):
    NEW = "new"
    LIKE_NEW = "like_new"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(10), unique=True, nullable=False, index=True, default=generate_public_id)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    is_negotiable = Column(Boolean, default=False)
    condition = Column(SAEnum(ListingCondition), nullable=False, default=ListingCondition.GOOD)
    status = Column(SAEnum(ListingStatus), nullable=False, default=ListingStatus.ACTIVE, index=True)

    # Relations
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)

    # Location
    location = Column(String(200), nullable=True)

    # Preferred contact method (comma-separated: email, whatsapp, phone)
    contact_method = Column(String(100), nullable=True)

    # Images — list of URLs
    images = Column(JSON, nullable=False, default=list)

    # Extra attributes (brand, size, etc.)
    attributes = Column(JSON, nullable=False, default=dict)

    # Counters
    view_count = Column(Integer, default=0)

    # Expiry / reminder tracking
    reminder_sent = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
