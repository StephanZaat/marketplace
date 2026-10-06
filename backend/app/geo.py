"""
IP -> country lookup against a local DB-IP Lite database (CC BY 4.0,
https://db-ip.com). The file is baked into the image at build time, so there
are no runtime calls to a third party.

Any failure (no database, private/unknown IP, corrupt file) returns None and
callers treat that as "unknown", never as foreign.
"""
import logging
import os
from functools import lru_cache

import maxminddb

logger = logging.getLogger(__name__)

GEOIP_DB = os.environ.get("GEOIP_DB", "/usr/share/geoip/dbip-country-lite.mmdb")


@lru_cache(maxsize=1)
def _reader():
    try:
        return maxminddb.open_database(GEOIP_DB)
    except (OSError, ValueError):
        logger.warning("GeoIP database not available at %s; country lookups disabled", GEOIP_DB)
        return None


def country_for_ip(ip: str | None) -> str | None:
    """Return the ISO 3166-1 alpha-2 code for `ip`, or None if unknown."""
    reader = _reader()
    if reader is None or not ip:
        return None
    try:
        record = reader.get(ip)
    except ValueError:
        return None
    if not isinstance(record, dict):
        return None
    return (record.get("country") or {}).get("iso_code")


def geoip_available() -> bool:
    """Whether country lookups work; surfaced on the admin dashboard."""
    return _reader() is not None
