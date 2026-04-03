import re
import shutil
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

_IMAGES_DIR = Path(__file__).parent / "uploads" / "images"
_VALID_EXTENSIONS = frozenset({"jpg", "jpeg", "png", "webp"})
_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}


def _safe_stem(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "image"


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"


def _get_s3_client(settings):
    import boto3
    return boto3.client(
        "s3",
        region_name=settings.objectstore_region,
        endpoint_url=settings.objectstore_endpoint,
        aws_access_key_id=settings.objectstore_access_key,
        aws_secret_access_key=settings.objectstore_secret_key,
    )


def resolve_image_url(key: str | None, settings) -> str | None:
    """Convert a stored relative key to a full URL for API responses.

    Handles three cases:
    - None / empty → None
    - Already a full URL (legacy data or external avatars) → returned as-is
    - Already a /images/ path (legacy local) → returned as-is
    - Relative key like 'listings/5/photo.jpg' → prepend objectstore URL or /images/
    """
    if not key:
        return None
    if key.startswith("http://") or key.startswith("https://") or key.startswith("/"):
        return key
    if settings.objectstore_enabled:
        return f"{settings.resolved_objectstore_public_url}/{key}"
    return f"/images/{key}"


def _key_from_url(url: str, settings) -> str:
    """Strip the public URL base to get the relative object key."""
    if not url.startswith("http"):
        # Already a key or /images/ path
        return url.lstrip("/")
    base = settings.resolved_objectstore_public_url
    if url.startswith(base):
        return url[len(base):].lstrip("/")
    return url


def _upload_to_objectstore(file: BinaryIO, object_key: str, content_type: str, settings) -> None:
    s3 = _get_s3_client(settings)
    s3.upload_fileobj(
        file, settings.objectstore_bucket, object_key,
        ExtraArgs={"ContentType": content_type, "ACL": "public-read"},
    )


def _delete_from_objectstore(object_key: str, settings) -> None:
    s3 = _get_s3_client(settings)
    s3.delete_object(Bucket=settings.objectstore_bucket, Key=object_key)


def _save_image(file: UploadFile, object_key: str, local_rel: Path, settings) -> str:
    """Internal: upload image to objectstore or local filesystem, return object_key."""
    original = file.filename or "image"
    ext = _extension(original)
    if ext not in _VALID_EXTENSIONS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Unsupported file type — use jpg, png or webp")

    if settings.objectstore_enabled:
        content_type = _CONTENT_TYPES.get(ext, "image/jpeg")
        _upload_to_objectstore(file.file, object_key, content_type, settings)
    else:
        dest = _IMAGES_DIR / local_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)

    return object_key


def save_listing_image(file: UploadFile, resource_id: int | str, settings) -> str:
    """Upload a listing image and return a relative storage key (never a full URL)."""
    original = file.filename or "image"
    stem = _safe_stem(original)
    ext = _extension(original)
    object_key = f"listings/{resource_id}/{stem}.{ext}"
    return _save_image(file, object_key, Path(f"listings/{resource_id}/{stem}.{ext}"), settings)


def save_avatar_image(file: UploadFile, user_id: int | str, settings) -> str:
    """Upload a user avatar and return a relative storage key (never a full URL)."""
    original = file.filename or "avatar"
    stem = _safe_stem(original)
    ext = _extension(original)
    object_key = f"avatars/{user_id}/{stem}.{ext}"
    return _save_image(file, object_key, Path(f"avatars/{user_id}/{stem}.{ext}"), settings)


def delete_listing_image(key_or_url: str, settings) -> None:
    """Delete an image by its relative key or legacy full URL."""
    if not key_or_url:
        return
    key = _key_from_url(key_or_url, settings)
    if settings.objectstore_enabled:
        try:
            _delete_from_objectstore(key, settings)
        except Exception:
            pass
    else:
        local_path = (_IMAGES_DIR / key).resolve()
        if local_path.is_relative_to(_IMAGES_DIR.resolve()):
            local_path.unlink(missing_ok=True)
