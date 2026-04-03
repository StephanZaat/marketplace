from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON
from app.database import Base
from app.utils import generate_public_id
from app.config import get_settings


def _json_column():
    """Use JSONB on PostgreSQL, plain JSON on SQLite (for tests)."""
    settings = get_settings()
    if settings.database_url.startswith("postgresql"):
        return Column(JSONB, nullable=True, default=list)
    return Column(JSON, nullable=True, default=list)


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(10), unique=True, nullable=False, index=True, default=generate_public_id)
    name = Column(String(100), nullable=False)
    name_es = Column(String(100), nullable=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    attributes = _json_column()
