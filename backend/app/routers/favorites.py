from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.database import get_db
from app.models.favorite import Favorite
from app.models.listing import Listing
from app.models.user import User
from app.models.category import Category
from app.resolve import resolve_public_id, _build_pid_map
from app.routers.auth import get_current_user
from app.schemas.listing import ListingOut
from app.storage import resolve_image_url, resolve_listing_images

router = APIRouter(prefix="/favorites", tags=["favorites"])
settings = get_settings()


@router.get("", response_model=List[ListingOut])
def list_favorites(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    favs = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    listing_ids = [f.listing_id for f in favs]
    if not listing_ids:
        return []
    rows = db.query(Listing).filter(Listing.id.in_(listing_ids)).all()
    seller_ids = {r.seller_id for r in rows}
    cat_ids = {r.category_id for r in rows}
    seller_pid_map = _build_pid_map(db, User, seller_ids)
    cat_pid_map = _build_pid_map(db, Category, cat_ids)
    results = []
    for r in rows:
        d = {c.key: getattr(r, c.key) for c in r.__table__.columns}
        d["id"] = d.pop("public_id")
        d["seller_id"] = seller_pid_map.get(r.seller_id, "")
        d["category_id"] = cat_pid_map.get(r.category_id, "")
        resolve_listing_images(d, settings)
        results.append(d)
    return results


@router.post("/{listing_id}", status_code=201)
def add_favorite(listing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot favorite your own listing")
    fav = Favorite(user_id=current_user.id, listing_id=listing.id)
    db.add(fav)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # already favorited -- treat as no-op
    return {"favorited": True}


@router.delete("/{listing_id}", status_code=200)
def remove_favorite(listing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.listing_id == listing.id,
    ).delete()
    db.commit()
    return {"favorited": False}
