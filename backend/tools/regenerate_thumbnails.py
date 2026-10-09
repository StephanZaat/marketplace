"""Rebuild every listing thumbnail from its full-size image (after a thumbnail format change).

Run inside the backend container:
    docker exec marketplace_backend python tools/regenerate_thumbnails.py [--dry-run]
"""
import io
import sys

sys.path.insert(0, "/app")

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.listing import Listing  # noqa: E402
from app.storage import (  # noqa: E402
    _CACHE_THUMB, _IMAGES_DIR, _get_s3_client, _key_from_url, _thumb_key, _upload_to_objectstore, make_thumbnail,
)


def main() -> None:
    dry = "--dry-run" in sys.argv
    settings = get_settings()
    s3 = _get_s3_client(settings) if settings.objectstore_enabled else None
    db = SessionLocal()
    ok = failed = 0
    try:
        keys = {_key_from_url(img, settings) for (imgs,) in db.query(Listing.images) for img in (imgs or [])}
    finally:
        db.close()
    for key in sorted(keys):
        try:
            if s3:
                raw = s3.get_object(Bucket=settings.objectstore_bucket, Key=key)["Body"].read()
            else:
                raw = (_IMAGES_DIR / key).read_bytes()
            thumb = make_thumbnail(io.BytesIO(raw))
            if not dry:
                if s3:
                    _upload_to_objectstore(thumb, _thumb_key(key), "image/jpeg", settings, cache_control=_CACHE_THUMB)
                else:
                    (_IMAGES_DIR / _thumb_key(key)).write_bytes(thumb.getvalue())
            ok += 1
        except Exception as e:  # keep going; report at the end
            failed += 1
            print(f"FAILED {key}: {e}")
    print(f"{'Would rebuild' if dry else 'Rebuilt'} {ok} thumbnails, {failed} failed")


if __name__ == "__main__":
    main()
