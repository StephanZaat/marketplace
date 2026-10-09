"""Apply Cache-Control to images already in the bucket (new uploads get it automatically).

Full-size listing photos and avatars get the long immutable lifetime, thumbnails a week.
Metadata is replaced in place (S3 copy onto itself), the image bytes are untouched.

    docker exec marketplace_backend python tools/set_image_cache_headers.py [--dry-run]
"""
import sys

sys.path.insert(0, "/app")

from app.config import get_settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.listing import Listing  # noqa: E402
from app.models.user import User  # noqa: E402
from app.storage import _CACHE_FULL, _CACHE_THUMB, _get_s3_client, _key_from_url, _thumb_key  # noqa: E402


def main() -> None:
    settings = get_settings()
    if not settings.objectstore_enabled:
        sys.exit("Object storage not configured; nothing to do.")
    dry = "--dry-run" in sys.argv
    db = SessionLocal()
    try:
        full = {_key_from_url(i, settings) for (imgs,) in db.query(Listing.images) for i in (imgs or [])}
        thumbs = {_thumb_key(k) for k in full}
        full |= {_key_from_url(a, settings) for (a,) in db.query(User.avatar_url).filter(User.avatar_url.isnot(None))}
    finally:
        db.close()

    s3, bucket = _get_s3_client(settings), settings.objectstore_bucket
    ok = failed = 0
    for key, cache in [(k, _CACHE_FULL) for k in sorted(full)] + [(k, _CACHE_THUMB) for k in sorted(thumbs)]:
        try:
            if not dry:
                s3.copy_object(
                    Bucket=bucket, Key=key, CopySource={"Bucket": bucket, "Key": key},
                    MetadataDirective="REPLACE", ContentType="image/jpeg",
                    CacheControl=cache, ACL="public-read",
                )
            ok += 1
        except Exception as e:
            failed += 1
            print(f"FAILED {key}: {e}")
    print(f"{'Would update' if dry else 'Updated'} {ok} objects, {failed} failed")


if __name__ == "__main__":
    main()
