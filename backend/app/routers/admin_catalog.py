"""Admin: manage the category tree."""
import re
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.admin import Admin
from app.models.category import Category
from app.models.category_alert import CategoryAlert
from app.models.listing import Listing, ListingStatus
from app.resolve import resolve_public_id
from app.routers.admin_auth import get_current_admin

router = APIRouter(prefix="/admin/categories", tags=["admin"])
AdminDep = Annotated[Admin, Depends(get_current_admin)]


def _slugify(name: str, db: Session) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "category"
    slug, n = base, 2
    while db.query(Category.id).filter(Category.slug == slug).first():
        slug, n = f"{base}-{n}", n + 1
    return slug


def _resolve_parent(db: Session, parent_id: Optional[str], self_id: Optional[int] = None) -> Optional[int]:
    """Internal parent id; rejects making a category its own ancestor."""
    if not parent_id:
        return None
    parent = resolve_public_id(db, Category, parent_id, "Category")
    node = parent
    while node is not None:
        if self_id is not None and node.id == self_id:
            raise HTTPException(status_code=400, detail="A category can't be moved under itself")
        node = db.query(Category).filter(Category.id == node.parent_id).first() if node.parent_id else None
    return parent.id


@router.get("")
def list_categories(_admin: AdminDep, db: Session = Depends(get_db)):
    cats = db.query(Category).order_by(Category.sort_order, Category.name).all()
    pid = {c.id: c.public_id for c in cats}
    total = dict(db.query(Listing.category_id, func.count(Listing.id)).group_by(Listing.category_id))
    active = dict(db.query(Listing.category_id, func.count(Listing.id))
                  .filter(Listing.status == ListingStatus.ACTIVE).group_by(Listing.category_id))
    return [{
        "id": c.public_id,
        "name": c.name,
        "name_es": c.name_es,
        "slug": c.slug,
        "icon": c.icon,
        "sort_order": c.sort_order,
        "parent_id": pid.get(c.parent_id) if c.parent_id else None,
        "is_hidden": c.is_hidden,
        "listing_count": total.get(c.id, 0),
        "active_count": active.get(c.id, 0),
    } for c in cats]


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    name_es: Optional[str] = Field(None, max_length=100)
    icon: Optional[str] = Field(None, max_length=100)
    parent_id: Optional[str] = None
    sort_order: int = 0


class CategoryEdit(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    name_es: Optional[str] = Field(None, max_length=100)
    icon: Optional[str] = Field(None, max_length=100)
    parent_id: Optional[str] = None  # "" moves to top level
    sort_order: Optional[int] = None
    is_hidden: Optional[bool] = None


@router.post("", status_code=201)
def create_category(body: CategoryIn, _admin: AdminDep, db: Session = Depends(get_db)):
    cat = Category(
        name=body.name.strip(), name_es=(body.name_es or "").strip() or None, icon=body.icon,
        slug=_slugify(body.name, db), sort_order=body.sort_order,
        parent_id=_resolve_parent(db, body.parent_id), attributes=[],
    )
    db.add(cat)
    db.commit()
    return {"id": cat.public_id, "slug": cat.slug}


@router.patch("/{category_id}")
def edit_category(category_id: str, body: CategoryEdit, _admin: AdminDep, db: Session = Depends(get_db)):
    cat = resolve_public_id(db, Category, category_id, "Category")
    data = body.model_dump(exclude_unset=True)
    if "parent_id" in data:
        cat.parent_id = _resolve_parent(db, data.pop("parent_id"), self_id=cat.id)
    for field, value in data.items():
        if value is not None:
            setattr(cat, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    return {"id": cat.public_id}


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: str, _admin: AdminDep, db: Session = Depends(get_db)):
    """Only empty leaf categories can be deleted; hide the rest instead."""
    cat = resolve_public_id(db, Category, category_id, "Category")
    if db.query(Category.id).filter(Category.parent_id == cat.id).first():
        raise HTTPException(status_code=400, detail="Move or delete its subcategories first")
    if db.query(Listing.id).filter(Listing.category_id == cat.id).first():
        raise HTTPException(status_code=400, detail="It still has listings; move them or hide the category instead")
    db.query(CategoryAlert).filter(CategoryAlert.category_id == cat.id).delete(synchronize_session=False)
    db.delete(cat)
    db.commit()
