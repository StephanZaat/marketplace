#!/usr/bin/env python3
"""
Download seed images and upload them to the Scaleway objectstore.

Images are stored in structured folders:
  - listings/{listing_id}/{filename}.jpg
  - avatars/{user_id}/{filename}.jpg

After upload the script updates the DB so listings.images and users.avatar_url
contain the correct relative keys.

Usage:
    python3 scripts/download-and-upload-seed-images.py

Reads credentials from .env.test (or .env if .env.test not found).
Downloads images to scripts/seed-images/ locally, then uploads to the bucket.

Requires: pip install boto3 psycopg2-binary
"""
import os
import sys
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
env = {**load_env(repo_root / '.env'), **load_env(repo_root / '.env.test')}

ACCESS_KEY = env.get('OBJECTSTORE_ACCESS_KEY') or os.environ.get('OBJECTSTORE_ACCESS_KEY', '')
SECRET_KEY = env.get('OBJECTSTORE_SECRET_KEY') or os.environ.get('OBJECTSTORE_SECRET_KEY', '')
ENDPOINT   = env.get('OBJECTSTORE_ENDPOINT',   'https://s3.nl-ams.scw.cloud')
REGION     = env.get('OBJECTSTORE_REGION',     'nl-ams')
BUCKET     = env.get('OBJECTSTORE_BUCKET',     'marketplace-images')
DB_URL     = env.get('DATABASE_URL', '')

if not ACCESS_KEY or not SECRET_KEY:
    print("ERROR: OBJECTSTORE_ACCESS_KEY / OBJECTSTORE_SECRET_KEY not set in .env.test")
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
LOCAL_DIR.mkdir(exist_ok=True)

# ── Image manifest ─────────────────────────────────────────────────────────────

def u(photo_id, w=800):
    return f'https://images.unsplash.com/photo-{photo_id}?w={w}&q=80&auto=format&fit=crop'

def p(pic_id, w=800, h=600):
    """picsum.photos by numeric ID — always available."""
    return f'https://picsum.photos/id/{pic_id}/{w}/{h}'

LISTING_IMAGES = {
    # Watersports
    'surfboard-1':      u('1455729552865-3658a5d39692'),
    'surfboard-2':      u('1510414842594-a61c69b5ae57'),
    'surfboard-3':      u('1505118380757-91f5f5632de0'),
    'surfboard-4':      u('1507525428034-b723cf961d3e'),
    'wetsuit-1':        u('1544551763-46a013bb70d5'),
    'wetsuit-2':        u('1520869562399-e772f042f422'),
    'kite-1':           u('1612872087720-bb876e2e67d1'),
    'kite-2':           u('1558618666-fcd25c85cd64'),
    'sup-1':            u('1506905925346-21bda4d32df4'),
    'sup-2':            u('1502680390469-be75c86b636f'),
    'kayak-1':          u('1464207687429-7505649dae38'),
    # Cars
    'pickup-truck':     u('1609521263047-f8f205293f24'),
    'hatchback':        p(175),
    'suv':              u('1533473359331-0135ef1b58bf'),
    'city-car':         u('1541899481282-d53bffe3c35d'),
    'tesla':            u('1560958089-b8a1929cea89'),
    'car-interior':     u('1503376780353-7e6692767b70'),
    # Motorcycles
    'motorcycle-naked': u('1558981403-c5f9899a28bc'),
    'scooter':          p(179),
    'motorcycle-sport': p(164),
    # Furniture
    'bed':              u('1505693416388-ac5ce068fe85'),
    'dining-table':     u('1449965408869-eaa3f722e40d'),
    'shelving':         u('1507003211169-0a1dd7228f2d'),
    'sofa':             p(201),
    'standing-desk':    u('1593642632559-0c6d3fc62b89'),
    'wardrobe':         p(210),
    'office-chair':     u('1586023492125-27b2c045efd7'),
    'garden-furniture': u('1600585154526-990dced4db0d'),
    'garden-plants':    u('1416879595882-3373a0480b5b'),
    # Clothing
    'jacket':           u('1551028719-00167b16eac5'),
    'jeans':            u('1542272604-787c3835535d'),
    'sneakers':         u('1542291026-7eec264c27ff'),
    'summer-dress':     u('1515372039744-b8f02a3ae446'),
    'polo-shirt':       p(225),
    'running-shoes':    u('1542291026-7eec264c27ff'),
    'handbag':          p(238),
    'watch':            u('1523275335684-37898b6baf30'),
    # Electronics
    'iphone':           u('1511707171634-5f897ff02aa9'),
    'android-phone':    u('1574944985070-8f3ebc6b79d2'),
    'playstation':      u('1486572788966-cfd3df1f5b42'),
    'macbook':          u('1541807084-5c52b6b3adef'),
    'headphones':       u('1505740420928-5e560c06d30e'),
    'ipad':             u('1519125323398-675f0ddb6308'),
    'tv':               u('1507146426996-ef05306b995a'),
    'drone':            u('1508614589041-895b88991e3e'),
    'camera-dslr':      u('1502920514313-52581002a659'),
    'nintendo-switch':  u('1587486913049-53fc88980cfc'),
    # Garden & Tools
    'bbq-grill':        u('1583267746897-2cf415887172'),
    'lawnmower':        p(247),
    'plant-pots':       u('1416879595882-3373a0480b5b'),
    'pressure-washer':  u('1571019613454-1cb2f99b2d8b'),
    'power-drill':      u('1581091226825-a6a2a5aee158'),
    'jigsaw':           p(274),
    'hand-tools':       p(119),
    'laser-level':      p(119),
    # Sport & Fitness
    'rowing-machine':   u('1521572163474-6864f9cf17ab'),
    'dumbbells':        u('1517836357463-d25dfeac3438'),
    'road-bike':        u('1571019613454-1cb2f99b2d8b'),
    'exercise-bike':    u('1601422407692-ec4eeec1d9b3'),
    'yoga-mat':         u('1506629082955-511b1aa562c8'),
    'city-bike':        u('1485965120184-e220f721d03e'),
    'tennis-racket':    p(366),
    # Kids
    'lego':             u('1464349153735-7db50ed83c84'),
    'stroller':         u('1566004100631-35d015d6a491'),
    'kids-bike':        p(278),
    'baby-bouncer':     u('1515488042361-ee00e0ddd4e4'),
    # Music
    'guitar':           u('1510915361894-db8b60106cb1'),
    'piano-keyboard':   u('1493225457124-a3eb161ffa5f'),
    'dj-controller':    u('1470225620780-dba8ba36b745'),
    # Books & Appliances
    'books':            u('1512820790803-83ca734da794'),
    'coffee-machine':   u('1514432324607-a09d9b4aefdd'),
    'vacuum-cleaner':   p(312),
    'air-fryer':        u('1627308595229-7830a5c91f9f'),
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def download(name, url):
    dest = LOCAL_DIR / f'{name}.jpg'
    if dest.exists():
        return name, 'SKIP', None
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        dest.write_bytes(data)
        return name, 'OK', len(data) // 1024
    except Exception as e:
        return name, 'FAIL', str(e)

def upload_file(local_path, key):
    try:
        s3.upload_file(str(local_path), BUCKET, key,
                       ExtraArgs={'ACL': 'public-read', 'ContentType': 'image/jpeg'})
        return key, 'OK', None
    except Exception as e:
        return key, 'FAIL', str(e)

def run_parallel(fn, items, workers=10):
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(fn, *args): args for args in items}
        for fut in as_completed(futures):
            name, status, info = fut.result()
            if status == 'OK' and info:
                print(f'  OK    {name} ({info}kB)')
            elif status == 'SKIP':
                print(f'  SKIP  {name}')
            elif status == 'FAIL':
                print(f'  FAIL  {name}: {info}')
            else:
                print(f'  OK    {name}')

# ── Download listing images ───────────────────────────────────────────────────

print(f'=== Downloading {len(LISTING_IMAGES)} listing images ===')
run_parallel(download, LISTING_IMAGES.items())

# ── Connect to DB and get listings + users ────────────────────────────────────

print()
print('=== Reading DB for listing IDs and user IDs ===')

# Build DB connection from env
db_host = env.get('POSTGRES_HOST', 'localhost')
db_port = env.get('POSTGRES_PORT', '5432')
db_name = env.get('POSTGRES_DB', 'marketplace')
db_user = env.get('POSTGRES_USER', 'marketplace_user')
db_pass = env.get('POSTGRES_PASSWORD', '')

# Try connecting via the running docker container's exposed port or use env
try:
    import psycopg2
    import json as _json

    conn = psycopg2.connect(
        host=db_host, port=db_port, dbname=db_name, user=db_user, password=db_pass
    )
    cur = conn.cursor()

    # Fetch all listings with their image arrays
    cur.execute("SELECT id, title, images FROM listings ORDER BY id")
    listings_rows = cur.fetchall()

    # Fetch all users
    cur.execute("SELECT id, email, avatar_url FROM users ORDER BY id")
    users_rows = cur.fetchall()

    print(f'  Found {len(listings_rows)} listings, {len(users_rows)} users')

except Exception as e:
    print(f'  DB connect failed: {e}')
    print('  Will upload images to listings/ folder without DB update.')
    print('  Run seed script first, then re-run this script.')
    listings_rows = []
    users_rows = []
    conn = None
    cur = None

# ── Upload listing images to listings/{id}/ ───────────────────────────────────

print()
print('=== Uploading listing images to listings/{id}/ ===')

# Map filename stem → listing IDs that use it
from collections import defaultdict
stem_to_listing_ids = defaultdict(list)
for listing_id, title, images in listings_rows:
    if not images:
        continue
    for img in images:
        stem = img.replace('.jpg', '').replace('.jpeg', '').replace('.png', '').replace('.webp', '')
        stem_to_listing_ids[stem].append(listing_id)

# Upload each image to every listing folder that uses it, collect new keys
listing_image_updates = {}  # listing_id → [new_key, ...]
upload_tasks = []
for listing_id, title, images in listings_rows:
    if not images:
        continue
    new_keys = []
    for img in images:
        stem = img.replace('.jpg', '')
        local = LOCAL_DIR / f'{stem}.jpg'
        key = f'listings/{listing_id}/{stem}.jpg'
        new_keys.append(key)
        if local.exists():
            upload_tasks.append((local, key))
        else:
            print(f'  MISSING local file: {stem}.jpg (for listing {listing_id})')
    listing_image_updates[listing_id] = new_keys

def _upload_task(local_path, key):
    return upload_file(local_path, key)

run_parallel(_upload_task, upload_tasks, workers=10)

# ── Upload avatars — avatars use ui-avatars.com URLs, no upload needed ────────
# Seed users have ui-avatars.com URLs stored directly. These pass through
# resolve_image_url unchanged (they start with https://). No upload needed.
print()
print('=== Avatars: using ui-avatars.com URLs (no upload needed) ===')
for user_id, email, avatar_url in users_rows:
    if avatar_url and avatar_url.startswith('https://ui-avatars.com'):
        print(f'  OK    {email} → {avatar_url[:60]}...')

# ── Update DB with new listing image keys ─────────────────────────────────────

if conn and listing_image_updates:
    print()
    print('=== Updating DB: listings.images with new keys ===')
    import json as _json
    for listing_id, new_keys in listing_image_updates.items():
        cur.execute(
            "UPDATE listings SET images = %s WHERE id = %s",
            (_json.dumps(new_keys), listing_id)
        )
        print(f'  listing {listing_id}: {new_keys}')
    conn.commit()
    cur.close()
    conn.close()
    print('  DB updated.')

print()
print('Done.')
print(f'Bucket: s3://{BUCKET}/')
print(f'Structure: listings/{{id}}/{{filename}}.jpg')
