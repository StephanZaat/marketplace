from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, model_validator


class RatingCreate(BaseModel):
    listing_id: str
    ratee_id: str
    role: Literal["buyer_rating_seller", "seller_rating_buyer"]
    score_description: Optional[int] = None
    score_communication: Optional[int] = None
    score_exchange: Optional[int] = None
    score_overall: Optional[int] = None

    @model_validator(mode="after")
    def validate_scores(self) -> "RatingCreate":
        def valid(v: Optional[int]) -> bool:
            return v is not None and 1 <= v <= 5

        if self.role == "buyer_rating_seller":
            if not all(valid(s) for s in [self.score_description, self.score_communication, self.score_exchange]):
                raise ValueError("Provide scores 1-5 for Description, Communication, and Exchange")
        else:
            if not valid(self.score_overall):
                raise ValueError("Provide an overall score 1-5")
        return self


class RatingOut(BaseModel):
    id: int
    listing_id: str
    rater_id: str
    ratee_id: str
    role: str
    score_description: Optional[int] = None
    score_communication: Optional[int] = None
    score_exchange: Optional[int] = None
    score_overall: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PendingRating(BaseModel):
    conversation_id: str
    listing_id: str
    listing_title: str
    other_user_id: str
    other_user_name: Optional[str] = None
    role: str  # "buyer_rating_seller" | "seller_rating_buyer"


class SellerStats(BaseModel):
    avg_description: Optional[float] = None
    avg_communication: Optional[float] = None
    avg_exchange: Optional[float] = None
    avg_overall: Optional[float] = None
    count: int = 0


class BuyerStats(BaseModel):
    avg_overall: Optional[float] = None
    count: int = 0


class UserRatingStats(BaseModel):
    as_seller: SellerStats
    as_buyer: BuyerStats
