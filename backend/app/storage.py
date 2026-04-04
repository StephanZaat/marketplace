import io
import re
import shutil
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile
from PIL import Image, ImageOps

_IMAGES_DIR = Path(__file__).parent / "uploads" / "images"
_VALID_EXTENSIONS = frozenset({"jpg", "jpeg", "png", "webp"})
_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
}

# Resize limits
_FULL_MAX = 1200
_THUMB_MAX = 400
_AVATAR_MAX = 256
_JPEG_QUALITY_FULL = 85
_JPEG_QUALITY_THUMB = 80


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


def _resize_image(file: BinaryIO, max_size: int, quality: int) -> io.BytesIO:
    """Resize image so longest side <= max_size. Returns JPEG bytes."""
    img = Image.open(file)
    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    if max(img.size) > max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    buf.seek(0)
    return buf


def _thumb_key(object_key: str) -> str:
    """Derive thumbnail key from full-size key: 'foo/bar.jpg' -> 'foo/bar_thumb.jpg'"""
    stem, _, ext = object_key.rpartition(".")
    return f"{stem}_thumb.jpg" if stem else f"{object_key}_thumb.jpg"


def resolve_image_url(key: str | None, settings) -> str | None:
    """Convert a stored relative key to a full URL for API responses."""
    if not key:
        return None
    if key.startswith("http://") or key.startswith("https://") or key.startswith("/"):
        return key
    if settings.objectstore_enabled:
        return f"{settings.resolved_objectstore_public_url}/{key}"
    return f"/images/{key}"


def resolve_listing_images(d: dict, settings) -> None:
    """Resolve image URLs and set thumbnail on a listing dict in-place."""
    raw = d.get("images") or []
    d["images"] = [resolve_image_url(img, settings) for img in raw]
    if raw:
        d["thumbnail"] = resolve_image_url(_thumb_key(raw[0]), settings)
    else:
        d["thumbnail"] = None


def _key_from_url(url: str, settings) -> str:
    """Strip the public URL base to get the relative object key."""
    if not url.startswith("http"):
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


def _save_resized(file: UploadFile, object_key: str, local_rel: Path, settings,
                  max_size: int, quality: int, with_thumb: bool = False) -> str:
    """Resize image, upload full version (and optionally a thumbnail), return the full-size key."""
    original = file.filename or "image"
    ext = _extension(original)
    if ext not in _VALID_EXTENSIONS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Unsupported file type -- use jpg, png or webp")

    # Full-size key always ends in .jpg since we convert to JPEG
    full_key = object_key.rsplit(".", 1)[0] + ".jpg"
    full_local = Path(str(local_rel).rsplit(".", 1)[0] + ".jpg")

    raw = file.file.read()

    # Full-size
    full_buf = _resize_image(io.BytesIO(raw), max_size, quality)

    if settings.objectstore_enabled:
        _upload_to_objectstore(full_buf, full_key, "image/jpeg", settings)
    else:
        dest = _IMAGES_DIR / full_local
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as f:
            shutil.copyfileobj(full_buf, f)

    # Thumbnail
    if with_thumb:
        thumb_buf = _resize_image(io.BytesIO(raw), _THUMB_MAX, _JPEG_QUALITY_THUMB)
        tk = _thumb_key(full_key)
        if settings.objectstore_enabled:
            _upload_to_objectstore(thumb_buf, tk, "image/jpeg", settings)
        else:
            thumb_dest = _IMAGES_DIR / tk
            thumb_dest.parent.mkdir(parents=True, exist_ok=True)
            with open(thumb_dest, "wb") as f:
                shutil.copyfileobj(thumb_buf, f)

    return full_key


def save_listing_image(file: UploadFile, resource_id: int | str, settings) -> str:
    """Upload a listing image (full + thumbnail) and return the full-size key."""
    original = file.filename or "image"
    stem = _safe_stem(original)
    ext = _extension(original)
    object_key = f"listings/{resource_id}/{stem}.{ext}"
    return _save_resized(file, object_key, Path(object_key), settings,
                         max_size=_FULL_MAX, quality=_JPEG_QUALITY_FULL, with_thumb=True)


def save_avatar_image(file: UploadFile, user_id: int | str, settings) -> str:
    """Upload a user avatar (single size) and return the key."""
    original = file.filename or "avatar"
    stem = _safe_stem(original)
    ext = _extension(original)
    object_key = f"avatars/{user_id}/{stem}.{ext}"
    return _save_resized(file, object_key, Path(object_key), settings,
                         max_size=_AVATAR_MAX, quality=_JPEG_QUALITY_FULL, with_thumb=False)


def delete_listing_image(key_or_url: str, settings) -> None:
    """Delete an image (and its thumbnail) by its relative key or legacy full URL."""
    if not key_or_url:
        return
    key = _key_from_url(key_or_url, settings)
    tk = _thumb_key(key)
    if settings.objectstore_enabled:
        try:
            _delete_from_objectstore(key, settings)
        except Exception:
            pass
        try:
            _delete_from_objectstore(tk, settings)
        except Exception:
            pass
    else:
        for k in (key, tk):
            local_path = (_IMAGES_DIR / k).resolve()
            if local_path.is_relative_to(_IMAGES_DIR.resolve()):
                local_path.unlink(missing_ok=True)
