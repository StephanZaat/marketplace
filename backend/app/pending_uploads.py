"""Photos uploaded before their listing is saved (POST /api/uploads).

An `Upload` row marks a photo as unattached. Listing create/edit claims photos by
key, which deletes the rows; whatever is still unattached after a day is removed.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.upload import Upload
from app.storage import _key_from_url, delete_listing_image

logger = logging.getLogger(__name__)

MAX_IMAGES = 10
_STALE_AFTER = timedelta(hours=24)


def build_image_list(db: Session, user_id: int, entries: list[str], existing: list[str], settings) -> list[str]:
    """Turn a client's ordered image list into stored keys.

    Each entry is an image already in `existing` (key or URL) or one of the user's
    unattached upload keys, which gets claimed. Does not commit; the caller does.
    """
    if len(entries) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES} images per listing")
    current = {_key_from_url(img, settings) for img in existing}
    keys = [_key_from_url(e, settings) for e in entries]
    if len(set(keys)) != len(keys):
        raise HTTPException(status_code=400, detail="Duplicate image in list")
    new = [k for k in keys if k not in current]
    if new:
        _claim(db, user_id, new)
    return keys


def _claim(db: Session, user_id: int, keys: list[str]) -> None:
    owned = db.query(Upload.id).filter(Upload.user_id == user_id, Upload.key.in_(keys)).count()
    if owned != len(keys):
        raise HTTPException(status_code=400, detail="Unknown image")
    n = db.query(Upload).filter(Upload.user_id == user_id, Upload.key.in_(keys)).delete(synchronize_session=False)
    if n != len(keys):  # claimed by a concurrent request in between
        db.rollback()
        raise HTTPException(status_code=400, detail="Unknown image")


def take_user_uploads(db: Session, user_id: int) -> list[str]:
    """Delete the user's unattached upload rows (no commit) and return their keys."""
    keys = [k for (k,) in db.query(Upload.key).filter(Upload.user_id == user_id)]
    if keys:
        db.query(Upload).filter(Upload.user_id == user_id).delete(synchronize_session=False)
    return keys


def prune_stale_uploads(settings) -> int:
    """Remove unattached uploads older than a day: rows first, then their files."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - _STALE_AFTER
        # Read first: a DELETE takes a write lock even when nothing matches.
        if not db.query(Upload.id).filter(Upload.created_at < cutoff).first():
            return 0
        # RETURNING: only files whose row this run removed. A row claimed by a
        # listing meanwhile is gone already, so its file is never touched.
        keys = list(db.execute(delete(Upload).where(Upload.created_at < cutoff).returning(Upload.key)).scalars())
        db.commit()
    except Exception:
        logger.exception("Pruning stale uploads failed")
        return 0
    finally:
        db.close()
    for key in keys:
        try:
            delete_listing_image(key, settings)
        except Exception:
            logger.warning("Could not delete stale upload %s", key, exc_info=True)
    if keys:
        logger.info("Pruned %d unattached uploads", len(keys))
    return len(keys)
