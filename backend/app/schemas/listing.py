from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from app.models.listing import ListingCondition, ListingStatus
from app.schemas.user import UserPublic, UserContact
from app.schemas.category import CategoryOut


class ListingCreate(BaseModel):
    title: str
    description: str
    price: Decimal
    is_negotiable: bool = False
    condition: ListingCondition = ListingCondition.GOOD
    category_id: str
    location: Optional[str] = None
    contact_method: Optional[str] = None
    attributes: Dict[str, Any] = {}


class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    is_negotiable: Optional[bool] = None
    condition: Optional[ListingCondition] = None
    status: Optional[ListingStatus] = None
    category_id: Optional[str] = None
    location: Optional[str] = None
    contact_method: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None
    images: Optional[List[str]] = None
    sold_to_conversation_id: Optional[str] = None


class ListingOut(BaseModel):
    id: str
    title: str
    description: str
    price: Decimal
    is_negotiable: bool
    condition: ListingCondition
    status: ListingStatus
    seller_id: str
    category_id: str
    location: Optional[str] = None
    contact_method: Optional[str] = None
    images: List[str]
    thumbnail: Optional[str] = None
    attributes: Dict[str, Any]
    view_count: int
    created_at: datetime
    updated_at: datetime

    # Denormalised fields populated by the list endpoint (avoids N+1 queries)
    seller_location: Optional[str] = None
    seller_languages: Optional[str] = None
    seller_avg_rating: Optional[float] = None
    category_icon: Optional[str] = None
    category_name: Optional[str] = None
    category_name_es: Optional[str] = None

    model_config = {"from_attributes": True}


class ListingDetail(ListingOut):
    seller: UserContact
    category: CategoryOut
    favorite_count: int = 0
