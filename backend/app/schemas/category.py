from typing import Any, Optional, List
from pydantic import BaseModel


class CategoryParent(BaseModel):
    id: str
    name: str
    name_es: Optional[str] = None
    slug: str

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: str
    name: str
    name_es: Optional[str] = None
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int
    parent_id: Optional[str] = None
    parent: Optional[CategoryParent] = None
    attributes: List[Any] = []

    model_config = {"from_attributes": True}


class CategoryTree(CategoryOut):
    children: List["CategoryTree"] = []
    listing_count: int = 0
