"""Admin: view/edit any listing, feature it, and act on several at once."""
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.admin import Admin
from app.models.category import Category
from app.models.listing import Listing, ListingCondition, ListingStatus
from app.models.user import User
from app.resolve import resolve_public_id
from app.routers.admin_auth import get_current_admin
from app.storage import resolve_image_url

router = APIRouter(prefix="/admin", tags=["admin"])
AdminDep = Annotated[Admin, Depends(get_current_admin)]


def approve_pending(db: Session, listing: Listing, background_tasks: BackgroundTasks) -> None:
    """Publish a pending listing and trust its seller (caller commits)."""
    if listing.status != ListingStatus.PENDING:
        raise HTTPException(status_code=400, detail="Listing is not pending review")
    seller = db.query(User).filter(User.id == listing.seller_id).first()
    listing.status = ListingStatus.ACTIVE
    seller.is_trusted = True
    from app import email as mail
    category = db.query(Category).filter(Category.id == listing.category_id).first()
    background_tasks.add_task(mail.send_new_listing, seller, listing, category.name if category else "")


def _detail(db: Session, listing: Listing) -> dict:
    settings = get_settings()
    seller = db.query(User).filter(User.id == listing.seller_id).first()
    category = db.query(Category).filter(Category.id == listing.category_id).first()
    return {
        "id": listing.public_id,
        "title": listing.title,
        "description": listing.description,
        "price": str(listing.price),
        "is_negotiable": listing.is_negotiable,
        "condition": listing.condition.value,
        "status": listing.status.value,
        "location": listing.location,
        "category_id": category.public_id if category else None,
        "is_featured": listing.is_featured,
        "created_country": listing.created_country,
        "view_count": listing.view_count,
        "images": [resolve_image_url(i, settings) for i in (listing.images or [])],
        "created_at": listing.created_at.isoformat(),
        "seller": {
            "id": seller.public_id, "name": seller.full_name, "email": seller.email,
            "is_trusted": seller.is_trusted, "is_active": seller.is_active,
        } if seller else None,
    }


@router.get("/listings/{listing_id}")
def get_listing(listing_id: str, _admin: AdminDep, db: Session = Depends(get_db)):
    return _detail(db, resolve_public_id(db, Listing, listing_id, "Listing"))


class ListingAdminEdit(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1, max_length=5000)
    price: Optional[Decimal] = Field(None, ge=0)
    is_negotiable: Optional[bool] = None
    condition: Optional[ListingCondition] = None
    location: Optional[str] = Field(None, max_length=200)
    category_id: Optional[str] = None
    is_featured: Optional[bool] = None


@router.patch("/listings/{listing_id}/edit")
def edit_listing(listing_id: str, body: ListingAdminEdit, _admin: AdminDep, db: Session = Depends(get_db)):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    for field, value in body.model_dump(exclude_none=True, exclude={"category_id"}).items():
        setattr(listing, field, value)
    if body.category_id is not None:
        listing.category_id = resolve_public_id(db, Category, body.category_id, "Category").id
    db.commit()
    return _detail(db, listing)


class BulkAction(BaseModel):
    ids: List[str] = Field(min_length=1, max_length=100)
    action: Literal["approve", "reject", "deactivate", "activate", "feature", "unfeature"]


@router.post("/listings/bulk")
def bulk_action(body: BulkAction, background_tasks: BackgroundTasks, _admin: AdminDep, db: Session = Depends(get_db)):
    """Apply one action to many listings; returns per-listing failures instead of aborting."""
    done, failed = [], {}
    for pid in body.ids:
        listing = db.query(Listing).filter(Listing.public_id == pid).first()
        if listing is None:
            failed[pid] = "not found"
            continue
        if body.action == "approve":
            if listing.status != ListingStatus.PENDING:
                failed[pid] = "not pending"
                continue
            approve_pending(db, listing, background_tasks)
        elif body.action in ("reject", "deactivate"):
            listing.status = ListingStatus.INACTIVE
        elif body.action == "activate":
            listing.status = ListingStatus.ACTIVE
        else:
            listing.is_featured = body.action == "feature"
        done.append(pid)
    db.commit()
    return {"done": done, "failed": failed}
