from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.user import UserPublic
from app.schemas.listing import ListingOut


class MessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


class MessageOut(BaseModel):
    id: int
    conversation_id: str
    sender_id: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: str
    listing_id: str
    buyer_id: str
    seller_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationOut):
    listing: Optional[ListingOut] = None
    buyer: Optional[UserPublic] = None
    seller: Optional[UserPublic] = None
    messages: List[MessageOut] = []
    unread_count: int = 0
