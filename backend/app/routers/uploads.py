"""Instant photo upload: photos are stored as soon as they're picked, then
attached to a listing on create/edit (see app.pending_uploads)."""
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.models.upload import Upload
from app.models.user import User
from app.routers.auth import get_current_user
from app.storage import _thumb_key, delete_listing_image, resolve_image_url, save_upload_image

router = APIRouter(prefix="/uploads", tags=["uploads"])
settings = get_settings()


@router.post("", status_code=201)
@limiter.limit("120/hour")
def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    key = save_upload_image(file, current_user.public_id, settings)
    db.add(Upload(key=key, user_id=current_user.id))
    db.commit()
    return {
        "key": key,
        "url": resolve_image_url(key, settings),
        "thumbnail": resolve_image_url(_thumb_key(key), settings),
    }


@router.delete("", status_code=204)
def delete_upload(
    key: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(Upload).filter(Upload.key == key, Upload.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Upload not found")
    db.delete(row)
    db.commit()
    delete_listing_image(key, settings)
    return Response(status_code=204)
