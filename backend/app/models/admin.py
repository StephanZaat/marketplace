from sqlalchemy import Boolean, Column, Integer, String
from app.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=False, server_default="false")
