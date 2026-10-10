"""First-party, cookie-free visitor stats: classify and anonymise a page view.

Designed to be lifted into a shared service for other sites later: nothing here
depends on marketplace models besides PageView.
"""
import hashlib
import hmac
import re
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

# Days are counted in the site's local time (Aruba: UTC-4, no DST).
SITE_TZ = timezone(timedelta(hours=-4))


def site_day(ts: datetime) -> date:
    return ts.astimezone(SITE_TZ).date()


_BOT = re.compile(
    r"bot|crawl|spider|slurp|scrape|headless|lighthouse|pingdom|uptime|monitor|preview|"
    r"facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python-|httpx|go-http|java/",
    re.I,
)


def is_bot(user_agent: str | None) -> bool:
    return not user_agent or bool(_BOT.search(user_agent))


def device_of(ua: str) -> str:
    if re.search(r"ipad|tablet|android(?!.*mobile)", ua, re.I):
        return "tablet"
    if re.search(r"mobi|iphone|ipod|android", ua, re.I):
        return "mobile"
    return "desktop"


def os_of(ua: str) -> str | None:
    for pattern, name in ((r"iphone|ipad|ipod", "iOS"), (r"android", "Android"), (r"windows", "Windows"),
                          (r"mac os x|macintosh", "macOS"), (r"cros", "ChromeOS"), (r"linux", "Linux")):
        if re.search(pattern, ua, re.I):
            return name
    return None


def visitor_hash(secret: str, ip: str, ua: str, day: date) -> str:
    """Same visitor → same hash for one UTC day only; IP can't be recovered."""
    return hmac.new(secret.encode(), f"{day.isoformat()}|{ip}|{ua}".encode(), hashlib.sha256).hexdigest()[:16]


def clean_path(path: str) -> str:
    path = (path or "/").split("?", 1)[0].split("#", 1)[0]
    return ("/" + path.lstrip("/"))[:300]


def source_of(referrer: str | None, utm_source: str | None, own_hosts: set[str]) -> str | None:
    """utm_source wins; else the referring host (minus www.), ignoring our own site."""
    if utm_source and utm_source.strip():
        return utm_source.strip().lower()[:100]
    if not referrer:
        return None
    host = (urlparse(referrer).hostname or "").lower().removeprefix("www.")
    if not host or host in {h.lower().removeprefix("www.") for h in own_hosts if h}:
        return None
    return host[:100]
