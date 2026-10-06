"""Download the DB-IP Lite country database at image build time.

Tries the current month, then the previous one (new files appear a few days
into the month). Never fails the build: without the file the app logs a
warning and treats every country as unknown.
"""
import gzip
import os
import sys
import urllib.request
from datetime import date, timedelta

DEST = "/usr/share/geoip/dbip-country-lite.mmdb"
URL = "https://download.db-ip.com/free/dbip-country-lite-{}.mmdb.gz"


def months():
    first = date.today().replace(day=1)
    yield os.environ.get("GEOIP_MONTH") or first.strftime("%Y-%m")
    yield (first - timedelta(days=1)).strftime("%Y-%m")


os.makedirs(os.path.dirname(DEST), exist_ok=True)
for month in months():
    try:
        # DB-IP rejects urllib's default User-Agent with 403
        req = urllib.request.Request(URL.format(month), headers={"User-Agent": "marketplace.aw-build/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = gzip.decompress(resp.read())
        with open(DEST, "wb") as f:
            f.write(data)
        print(f"GeoIP: installed DB-IP country lite {month} ({len(data) // 1024} KiB)")
        sys.exit(0)
    except Exception as e:  # noqa: BLE001 - any failure falls through to the next month
        print(f"GeoIP: {month} unavailable: {e}")
print("GeoIP: WARNING no database installed; off-island review disabled")
