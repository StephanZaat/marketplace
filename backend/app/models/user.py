from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Integer, String, DateTime, Text
from app.database import Base
from app.utils import generate_public_id



class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(10), unique=True, nullable=False, index=True, default=generate_public_id)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)   # null for social-login users
    full_name = Column(String(200), nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    whatsapp = Column(String(50), nullable=True)
    contact_method = Column(String(100), nullable=True)
    languages = Column(String(200), nullable=True)
    preferred_language = Column(String(5), nullable=True)  # "en" | "es" | null (use site default)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Password reset (null when not requested)
    password_reset_token = Column(String(64), nullable=True, index=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
