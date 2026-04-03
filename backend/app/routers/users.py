from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.models.rating import Rating
from app.resolve import resolve_public_id, user_to_public_dict
from app.routers.auth import get_current_user
from app.schemas.user import UserPublic, UserMe, UserUpdate
from app.storage import save_avatar_image, delete_listing_image, resolve_image_url

router = APIRouter(prefix="/users", tags=["users"])
settings = get_settings()


def _resolve_user(user: User) -> dict:
    """Return a dict of user fields with avatar_url resolved to a full URL."""
    d = user_to_public_dict(user)
    d["avatar_url"] = resolve_image_url(d.get("avatar_url"), settings)
    return d


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.public_id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    methods = {m.strip() for m in (user.contact_method or "").split(",") if m.strip()}

    # Compute seller avg rating
    seller_rows = db.query(Rating).filter(
        Rating.ratee_id == user.id,
        Rating.role == "buyer_rating_seller",
    ).all()
    avg_rating = None
    if seller_rows:
        avg_rating = round(
            sum((r.score_description + r.score_communication + r.score_exchange) / 3.0 for r in seller_rows)
            / len(seller_rows), 1
        )

    return UserPublic(
        id=user.public_id,
        full_name=user.full_name,
        bio=user.bio,
        location=user.location,
        avatar_url=resolve_image_url(user.avatar_url, settings),
        phone=user.phone if "phone" in methods else None,
        whatsapp=user.whatsapp if "whatsapp" in methods else None,
        contact_method=user.contact_method,
        languages=user.languages,
        created_at=user.created_at,
        avg_rating=avg_rating,
        rating_count=len(seller_rows),
    )


@router.patch("/me", response_model=UserMe)
def update_me(data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserMe.model_validate(_resolve_user(current_user))


@router.post("/me/avatar", response_model=UserMe)
def upload_avatar(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.avatar_url:
        try:
            delete_listing_image(current_user.avatar_url, settings)
        except Exception:
            pass
    key = save_avatar_image(file, current_user.id, settings)
    current_user.avatar_url = key
    db.commit()
    db.refresh(current_user)
    return UserMe.model_validate(_resolve_user(current_user))


@router.delete("/me/avatar", response_model=UserMe)
def delete_avatar(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.avatar_url:
        try:
            delete_listing_image(current_user.avatar_url, settings)
        except Exception:
            pass
    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return UserMe.model_validate(_resolve_user(current_user))
