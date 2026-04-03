#!/usr/bin/env python3
"""
Upload seed images to the Scaleway objectstore.

After running the seed script (which stores image keys as listings/{id}/1.jpg etc.),
this script reads the listing image mappings from the API and uploads the correct
source image to each key.

Usage:
    python3 scripts/upload-seed-images.py [--env test|prod]

Reads credentials from .env.test (or .env).
Source images must be in scripts/seed-images/.

Requires: pip install boto3
"""
import os
import sys
import json
import pathlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# ── Load env ──────────────────────────────────────────────────────────────────

def load_env(path):
    env = {}
    try:
        for line in open(path):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env

script_dir = pathlib.Path(__file__).parent
repo_root = script_dir.parent

env_file = '.env.prod' if '--env' in sys.argv and sys.argv[sys.argv.index('--env') + 1] == 'prod' else '.env.test'
env = {**load_env(repo_root / '.env'), **load_env(repo_root / env_file)}

ACCESS_KEY = env.get('OBJECTSTORE_ACCESS_KEY') or os.environ.get('OBJECTSTORE_ACCESS_KEY', '')
SECRET_KEY = env.get('OBJECTSTORE_SECRET_KEY') or os.environ.get('OBJECTSTORE_SECRET_KEY', '')
ENDPOINT   = env.get('OBJECTSTORE_ENDPOINT',   'https://s3.nl-ams.scw.cloud')
REGION     = env.get('OBJECTSTORE_REGION',     'nl-ams')
BUCKET     = env.get('OBJECTSTORE_BUCKET',     'marketplace-images-test')
SITE_URL   = env.get('SITE_URL', 'https://test.marketplacearuba.com')

if not ACCESS_KEY or not SECRET_KEY:
    print(f"ERROR: OBJECTSTORE_ACCESS_KEY / OBJECTSTORE_SECRET_KEY not set in {env_file}")
    sys.exit(1)

try:
    import boto3
    from botocore.client import Config
except ImportError:
    print("ERROR: boto3 not installed. Run: pip install boto3")
    sys.exit(1)

s3 = boto3.client(
    's3',
    endpoint_url=ENDPOINT,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    region_name=REGION,
    config=Config(signature_version='s3v4'),
)

LOCAL_DIR = script_dir / 'seed-images'

# ── Image source manifest ─────────────────────────────────────────────────────
# Maps source stem name → local filename (all .jpg)
# The seed script assigns images to listings in LISTINGS order.
# We need to know which stem goes to which listing position.
# This mirrors the LISTINGS array order in seed_listings.py:
LISTING_IMAGE_SOURCES = [
    # Watersports
    ["surfboard-1", "surfboard-2"],  # Lost Mayhem
    ["surfboard-3"],                  # Channel Islands
    ["surfboard-4"],                  # Firewire Helium
    ["surfboard-1", "surfboard-3"],   # Noserider Longboard
    ["surfboard-2", "surfboard-4"],   # Mini Simmons
    ["surfboard-3"],                  # Funboard
    ["wetsuit-1"],                    # Rip Curl
    ["wetsuit-2"],                    # O'Neill
    ["kite-1", "kite-2"],             # Cabrinha
    ["kite-2"],                       # North Orbit
    ["kite-1"],                       # Airush
    ["kite-2", "kite-1"],             # Duotone
    ["sup-1"],                        # Red Paddle Co
    ["sup-2", "sup-1"],               # Starboard Touring
    ["kayak-1"],                      # Sevylor Tahiti
    # Cars
    ["pickup-truck"],                 # Toyota Hilux
    ["hatchback"],                    # Honda Jazz
    ["pickup-truck", "car-interior"], # Ford Ranger
    ["suv"],                          # Suzuki Jimny
    ["hatchback", "car-interior"],    # VW Golf
    ["city-car"],                     # Kia Picanto
    ["tesla", "car-interior"],        # Tesla Model 3
    # Motorcycles
    ["motorcycle-naked"],             # Honda CB500F
    ["scooter"],                      # Yamaha NMAX
    ["motorcycle-sport"],             # Kawasaki Z400
    ["scooter", "motorcycle-naked"],  # Honda Ruckus
    # Furniture
    ["bed"],                          # IKEA MALM
    ["dining-table"],                 # Oak Dining Table
    ["shelving"],                     # IKEA KALLAX
    ["sofa"],                         # Leather Sofa
    ["standing-desk", "office-chair"],# Standing Desk
    ["wardrobe"],                     # IKEA PAX
    ["office-chair"],                 # Herman Miller
    ["garden-furniture"],             # Rattan Garden
    ["garden-furniture", "garden-plants"], # Teak Garden
    # Clothing
    ["jacket"],                       # Patagonia
    ["jeans"],                        # Levi's 501
    ["sneakers"],                     # Nike Air Max
    ["summer-dress"],                 # Zara dress
    ["polo-shirt"],                   # Ralph Lauren
    ["running-shoes"],                # Asics
    ["handbag"],                      # Handbag
    ["watch"],                        # Watch
    # Electronics
    ["iphone"],                       # iPhone
    ["android-phone"],                # Android phone
    ["playstation"],                  # PlayStation
    ["macbook"],                      # MacBook
    ["headphones"],                   # Headphones
    ["ipad"],                         # iPad
    ["tv"],                           # TV
    ["drone"],                        # Drone
    ["camera-dslr"],                  # Camera DSLR
    ["nintendo-switch"],              # Nintendo Switch
    # Garden & Tools
    ["bbq-grill"],                    # BBQ Grill
    ["lawnmower"],                    # Lawnmower
    ["plant-pots"],                   # Plant Pots
    ["pressure-washer"],              # Pressure Washer
    ["power-drill"],                  # Power Drill
    ["jigsaw"],                       # Jigsaw
    ["hand-tools"],                   # Hand Tools
    ["laser-level"],                  # Laser Level
    # Sport & Fitness
    ["rowing-machine"],               # Rowing Machine
    ["dumbbells"],                    # Dumbbells
    ["road-bike"],                    # Road Bike
    ["exercise-bike"],                # Exercise Bike
    ["yoga-mat"],                     # Yoga Mat
    ["city-bike"],                    # City Bike
    ["tennis-racket"],                # Tennis Racket
    # Kids
    ["lego"],                         # LEGO
    ["stroller"],                     # Stroller
    ["kids-bike"],                    # Kids Bike
    ["baby-bouncer"],                 # Baby Bouncer
    # Music
    ["guitar"],                       # Guitar
    ["piano-keyboard"],               # Piano Keyboard
    ["dj-controller"],                # DJ Controller
    # Books & Appliances
    ["books"],                        # Books
    ["coffee-machine"],               # Coffee Machine
    ["vacuum-cleaner"],               # Vacuum Cleaner
    ["air-fryer"],                    # Air Fryer
]

# ── Fetch listing IDs from API ─────────────────────────────────────────────────
print(f'=== Fetching listings from {SITE_URL} ===')
listings = []
skip = 0
while True:
    url = f"{SITE_URL}/api/listings?skip={skip}&limit=100&sort_by=date&sort_dir=asc"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "uploader/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            batch = json.loads(r.read())
    except Exception as e:
        print(f"  API error: {e}")
        break
    if not batch:
        break
    listings.extend(batch)
    if len(batch) < 100:
        break
    skip += 100

# Filter to only seeded listings (those with images containing listings/{id}/)
seeded = [(l['id'], l.get('images', [])) for l in listings if l.get('images')]
print(f'  Found {len(seeded)} listings with images')

# ── Build upload tasks ────────────────────────────────────────────────────────
# Match listing IDs to source images by position in the seeded list
# The API returns listings sorted by creation date asc, which matches seed order

upload_tasks = []  # (local_path, bucket_key)

for i, (listing_id, image_keys) in enumerate(seeded):
    if i >= len(LISTING_IMAGE_SOURCES):
        print(f'  WARNING: no source mapping for listing {listing_id} (index {i})')
        continue
    sources = LISTING_IMAGE_SOURCES[i]
    for j, (key, stem) in enumerate(zip(image_keys, sources)):
        local = LOCAL_DIR / f'{stem}.jpg'
        # key may be a full URL — strip to relative path listings/{id}/N.jpg
        if key.startswith('http'):
            from urllib.parse import urlparse
            key = urlparse(key).path.lstrip('/')
        if local.exists():
            upload_tasks.append((local, key))
        else:
            print(f'  MISSING: {stem}.jpg for listing {listing_id}')

print(f'  {len(upload_tasks)} files to upload')

# ── Download missing images ───────────────────────────────────────────────────
def u(photo_id, w=800):
    return f'https://images.unsplash.com/photo-{photo_id}?w={w}&q=80&auto=format&fit=crop'
def p(pic_id, w=800, h=600):
    return f'https://picsum.photos/id/{pic_id}/{w}/{h}'

DOWNLOAD_URLS = {
    'surfboard-1': u('1455729552865-3658a5d39692'), 'surfboard-2': u('1510414842594-a61c69b5ae57'),
    'surfboard-3': u('1505118380757-91f5f5632de0'), 'surfboard-4': u('1507525428034-b723cf961d3e'),
    'wetsuit-1': u('1544551763-46a013bb70d5'), 'wetsuit-2': u('1520869562399-e772f042f422'),
    'kite-1': u('1612872087720-bb876e2e67d1'), 'kite-2': u('1558618666-fcd25c85cd64'),
    'sup-1': u('1506905925346-21bda4d32df4'), 'sup-2': u('1502680390469-be75c86b636f'),
    'kayak-1': u('1464207687429-7505649dae38'), 'pickup-truck': u('1609521263047-f8f205293f24'),
    'hatchback': p(175), 'suv': u('1533473359331-0135ef1b58bf'),
    'city-car': u('1541899481282-d53bffe3c35d'), 'tesla': u('1560958089-b8a1929cea89'),
    'car-interior': u('1503376780353-7e6692767b70'), 'motorcycle-naked': u('1558981403-c5f9899a28bc'),
    'scooter': p(179), 'motorcycle-sport': p(164), 'bed': u('1505693416388-ac5ce068fe85'),
    'dining-table': u('1449965408869-eaa3f722e40d'), 'shelving': u('1507003211169-0a1dd7228f2d'),
    'sofa': p(201), 'standing-desk': u('1593642632559-0c6d3fc62b89'), 'wardrobe': p(210),
    'office-chair': u('1586023492125-27b2c045efd7'), 'garden-furniture': u('1600585154526-990dced4db0d'),
    'garden-plants': u('1416879595882-3373a0480b5b'), 'jacket': u('1551028719-00167b16eac5'),
    'jeans': u('1542272604-787c3835535d'), 'sneakers': u('1542291026-7eec264c27ff'),
    'summer-dress': u('1515372039744-b8f02a3ae446'), 'polo-shirt': p(225),
    'running-shoes': u('1542291026-7eec264c27ff'), 'handbag': p(238),
    'watch': u('1523275335684-37898b6baf30'), 'iphone': u('1511707171634-5f897ff02aa9'),
    'android-phone': u('1574944985070-8f3ebc6b79d2'), 'playstation': u('1486572788966-cfd3df1f5b42'),
    'macbook': u('1541807084-5c52b6b3adef'), 'headphones': u('1505740420928-5e560c06d30e'),
    'ipad': u('1519125323398-675f0ddb6308'), 'tv': u('1507146426996-ef05306b995a'),
    'drone': u('1508614589041-895b88991e3e'), 'camera-dslr': u('1502920514313-52581002a659'),
    'nintendo-switch': u('1587486913049-53fc88980cfc'), 'bbq-grill': u('1583267746897-2cf415887172'),
    'lawnmower': p(247), 'plant-pots': u('1416879595882-3373a0480b5b'),
    'pressure-washer': u('1571019613454-1cb2f99b2d8b'), 'power-drill': u('1581091226825-a6a2a5aee158'),
    'jigsaw': p(274), 'hand-tools': p(119), 'laser-level': p(119),
    'rowing-machine': u('1521572163474-6864f9cf17ab'), 'dumbbells': u('1517836357463-d25dfeac3438'),
    'road-bike': u('1571019613454-1cb2f99b2d8b'), 'exercise-bike': u('1601422407692-ec4eeec1d9b3'),
    'yoga-mat': u('1506629082955-511b1aa562c8'), 'city-bike': u('1485965120184-e220f721d03e'),
    'tennis-racket': p(366), 'lego': u('1464349153735-7db50ed83c84'),
    'stroller': u('1566004100631-35d015d6a491'), 'kids-bike': p(278),
    'baby-bouncer': u('1515488042361-ee00e0ddd4e4'), 'guitar': u('1510915361894-db8b60106cb1'),
    'piano-keyboard': u('1493225457124-a3eb161ffa5f'), 'dj-controller': u('1470225620780-dba8ba36b745'),
    'books': u('1512820790803-83ca734da794'), 'coffee-machine': u('1514432324607-a09d9b4aefdd'),
    'vacuum-cleaner': p(312), 'air-fryer': u('1627308595229-7830a5c91f9f'),
}

missing_stems = {stem for _, key in upload_tasks for stem in [] if not (LOCAL_DIR / f'{stem}.jpg').exists()}
# Find actually missing ones
missing_stems = set()
for local, key in upload_tasks:
    if not local.exists():
        stem = local.stem
        missing_stems.add(stem)

if missing_stems:
    print(f'\n=== Downloading {len(missing_stems)} missing images ===')
    for stem in missing_stems:
        url = DOWNLOAD_URLS.get(stem)
        if not url:
            print(f'  NO URL for {stem}')
            continue
        dest = LOCAL_DIR / f'{stem}.jpg'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as r:
                dest.write_bytes(r.read())
            print(f'  Downloaded {stem}')
        except Exception as e:
            print(f'  FAIL {stem}: {e}')

# ── Upload ─────────────────────────────────────────────────────────────────────
print(f'\n=== Uploading {len(upload_tasks)} images to s3://{BUCKET}/ ===')

def do_upload(local_path, key):
    try:
        s3.upload_file(str(local_path), BUCKET, key,
                       ExtraArgs={'ACL': 'public-read', 'ContentType': 'image/jpeg'})
        return key, 'OK'
    except Exception as e:
        return key, f'FAIL: {e}'

with ThreadPoolExecutor(max_workers=10) as ex:
    futures = {ex.submit(do_upload, lp, k): k for lp, k in upload_tasks}
    ok = fail = 0
    for fut in as_completed(futures):
        key, status = fut.result()
        if status == 'OK':
            ok += 1
            print(f'  OK  {key}')
        else:
            fail += 1
            print(f'  {status}  {key}')

print(f'\nDone: {ok} uploaded, {fail} failed.')
