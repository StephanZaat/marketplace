from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class OtpSendRequest(BaseModel):
    email: EmailStr


class OtpSendResponse(BaseModel):
    otp_token: str
    is_new_user: bool


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str
    otp_token: str
    full_name: str | None = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    contact_method: Optional[str] = None
    languages: Optional[str] = None
    preferred_language: Optional[str] = None


class UserPublic(BaseModel):
    id: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    contact_method: Optional[str] = None
    languages: Optional[str] = None
    preferred_language: Optional[str] = None
    created_at: datetime
    avg_rating: Optional[float] = None
    rating_count: int = 0

    model_config = {"from_attributes": True}


class UserContact(UserPublic):
    """UserPublic extended with contact details for listing detail pages.
    Only fields the seller has explicitly enabled as contact methods are populated."""
    email: Optional[str] = None
    phone: Optional[str] = None


class UserMe(UserPublic):
    email: str
    phone: Optional[str] = None
    is_verified: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
