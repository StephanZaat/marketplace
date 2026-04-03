"""
Friendly Captcha v2 verification.

Calls the EU endpoint to verify captcha responses.
Disabled when FRIENDLY_CAPTCHA_SECRET is not set (dev/test).
"""
import json
import logging
import urllib.request
import urllib.error

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def verify_captcha(response: str | None) -> bool:
    """Verify a Friendly Captcha response token. Returns True if valid or if captcha is disabled."""
    if not settings.friendly_captcha_secret:
        return True  # captcha disabled in this environment

    if not response:
        return False

    payload = json.dumps({"response": response, "sitekey": settings.friendly_captcha_sitekey}).encode()
    req = urllib.request.Request(
        "https://global.frcapi.com/api/v2/captcha/siteverify",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": settings.friendly_captcha_secret,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            return data.get("success", False)
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        logger.error("Captcha verify failed: status=%s body=%s", e.code, body[:200])
        return False
    except Exception:
        logger.exception("Captcha verify error")
        return False
