from datetime import datetime, timezone
from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint, String
from app.database import Base


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("rater_id", "listing_id", name="uq_rating_per_listing"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    listing_id  = Column(Integer, ForeignKey("listings.id"), nullable=False, index=True)
    rater_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ratee_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # "buyer_rating_seller" or "seller_rating_buyer"
    role        = Column(String, nullable=False)

    # Buyer rates seller — three dimensions
    score_description   = Column(Integer, nullable=True)
    score_communication = Column(Integer, nullable=True)
    score_exchange      = Column(Integer, nullable=True)

    # Seller rates buyer — single overall score
    score_overall = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
