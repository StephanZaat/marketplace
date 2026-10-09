"""Card thumbnails are always 800x600 (the card's 4:3 shape), whatever the photo shape."""
import io

import pytest
from PIL import Image

from app.storage import make_thumbnail


def _jpeg(size, orientation=None):
    buf = io.BytesIO()
    img = Image.new("RGB", size, "teal")
    exif = img.getexif()
    if orientation:
        exif[0x0112] = orientation
    img.save(buf, format="JPEG", exif=exif.tobytes())
    buf.seek(0)
    return buf


@pytest.mark.parametrize("size", [(1884, 4080), (4080, 1884), (1200, 900), (300, 300)])
def test_thumbnail_is_800x600(size):
    assert Image.open(make_thumbnail(_jpeg(size))).size == (800, 600)


def test_phone_rotation_is_applied_before_crop():
    # Stored landscape but EXIF says "rotate 90": must be treated as portrait, still 800x600 out.
    thumb = Image.open(make_thumbnail(_jpeg((4080, 1884), orientation=6)))
    assert thumb.size == (800, 600)
    assert not thumb.getexif()
