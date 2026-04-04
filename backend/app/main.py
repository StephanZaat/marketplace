import json
import logging
import pathlib
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db, init_db, SessionLocal, engine
from app.limiter import limiter

logger = logging.getLogger(__name__)
settings = get_settings()

_SEED_CATEGORIES = json.loads(
    (pathlib.Path(__file__).parent / "data" / "categories.json").read_text()
)


def seed_admin():
    """Create initial admin user from ADMIN_USERNAME / ADMIN_PASSWORD env vars if none exists."""
    import os
    username = os.getenv("ADMIN_USERNAME")
    password = os.getenv("ADMIN_PASSWORD")
    if not username or not password:
        return
    from app.models.admin import Admin
    from app.routers.admin_auth import hash_password
    db = SessionLocal()
    try:
        if db.query(Admin).first():
            return  # already have an admin
        db.add(Admin(username=username, hashed_password=hash_password(password)))
        db.commit()
        logger.info("Admin user '%s' created.", username)
    finally:
        db.close()


def migrate_db():
    """Apply any schema changes not handled by create_all (for existing DBs)."""
    import secrets
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    cols = [c["name"] for c in insp.get_columns("categories")]
    if "name_es" not in cols:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE categories ADD COLUMN name_es VARCHAR(100)"))
            conn.commit()
        logger.info("Migrated: added categories.name_es")
        # Backfill name_es for existing rows from seed data
        _backfill_categories_name_es()

    is_postgres = settings.database_url.startswith("postgresql")

    # Add EXPIRED to the listingstatus enum if it doesn't exist yet (Postgres only)
    if is_postgres:
        with engine.connect() as conn:
            existing = conn.execute(text(
                "SELECT enumlabel FROM pg_enum "
                "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
                "WHERE pg_type.typname = 'listingstatus' AND enumlabel = 'EXPIRED'"
            )).fetchone()
            if not existing:
                conn.execute(text("ALTER TYPE listingstatus ADD VALUE 'EXPIRED'"))
                conn.commit()
                logger.info("Migrated: added EXPIRED to listingstatus enum")

    # Add public_id columns to listings, users, conversations, categories
    # Skip for SQLite — tests use create_all which creates columns from model definitions
    for table in ["listings", "users", "conversations", "categories"]:
        table_cols = [c["name"] for c in insp.get_columns(table)]
        if "public_id" not in table_cols and is_postgres:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN public_id VARCHAR(10)"))
                # Backfill existing rows
                rows = conn.execute(text(f"SELECT id FROM {table} WHERE public_id IS NULL")).fetchall()
                for row in rows:
                    pid = secrets.token_urlsafe(8)[:10]
                    conn.execute(text(f"UPDATE {table} SET public_id = :pid WHERE id = :id"), {"pid": pid, "id": row[0]})
                # Add constraints (Postgres supports ALTER COLUMN SET NOT NULL; SQLite doesn't but we handle it via ORM)
                if is_postgres:
                    conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN public_id SET NOT NULL"))
                conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{table}_public_id ON {table}(public_id)"))
                conn.commit()
            logger.info("Migrated: added public_id to %s", table)

    # Drop legacy password columns in a single transaction
    user_cols = [c["name"] for c in insp.get_columns("users")]
    cols_to_drop = [c for c in ("hashed_password", "password_reset_token", "password_reset_expires") if c in user_cols]
    if cols_to_drop and is_postgres:
        with engine.connect() as conn:
            for col in cols_to_drop:
                conn.execute(text(f"ALTER TABLE users DROP COLUMN {col}"))
            conn.commit()
        for col in cols_to_drop:
            logger.info("Migrated: dropped users.%s", col)


def _backfill_categories_name_es():
    from app.models.category import Category
    slug_to_es = {c["slug"]: c.get("name_es") for c in _SEED_CATEGORIES}
    db = SessionLocal()
    try:
        for cat in db.query(Category).all():
            if cat.slug in slug_to_es:
                cat.name_es = slug_to_es[cat.slug]
        db.commit()
        logger.info("Backfilled name_es for existing categories")
    finally:
        db.close()


def seed_data():
    from app.models.category import Category

    db = SessionLocal()
    try:
        existing = {c.slug: c for c in db.query(Category).all()}

        if existing:
            # Update attributes (e.g. options_es) on existing categories
            for cat in _SEED_CATEGORIES:
                obj = existing.get(cat["slug"])
                if obj and cat.get("attributes") is not None:
                    obj.attributes = cat["attributes"]
            db.commit()
            return

        slug_to_id: dict = {}
        for cat in _SEED_CATEGORIES:
            obj = Category(
                name=cat["name"],
                name_es=cat.get("name_es"),
                slug=cat["slug"],
                icon=cat.get("icon"),
                sort_order=cat.get("sort_order", 0),
                parent_id=None,
                attributes=cat.get("attributes", []),
            )
            db.add(obj)
            db.flush()
            slug_to_id[cat["slug"]] = obj.id

        for cat in _SEED_CATEGORIES:
            parent_slug = cat.get("parent_slug")
            if parent_slug and parent_slug in slug_to_id:
                db.query(Category).filter(
                    Category.id == slug_to_id[cat["slug"]]
                ).update({"parent_id": slug_to_id[parent_slug]})

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import time
    from sqlalchemy import text
    for attempt in range(30):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            break
        except Exception:
            if attempt == 29:
                raise
            logger.info("Waiting for database... (%d/30)", attempt + 1)
            time.sleep(2)
    try:
        logger.info("Running init_db...")
        init_db()
        logger.info("Running migrate_db...")
        migrate_db()
        logger.info("Running seed_data...")
        seed_data()
        logger.info("Running seed_admin...")
        seed_admin()
        logger.info("Startup complete.")
    except Exception:
        logger.exception("Startup failed — check DB connection and schema")
        raise

    from app.scheduler import run_scheduler
    import asyncio
    scheduler_task = asyncio.create_task(run_scheduler())

    yield

    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass


from app.routers import auth, users, categories, listings, messages, favorites, reports, admin_auth, admin, contact, alerts, ratings

app = FastAPI(
    title="Marketplace.aw",
    description="REST API for Marketplace.aw — second-hand marketplace.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(listings.router, prefix="/api")
app.include_router(messages.router, prefix="/api")
app.include_router(favorites.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(admin_auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")


@app.get("/api/prerender")
def prerender(path: str = Query("/"), db: Session = Depends(get_db)):
    """Serve minimal HTML with correct meta tags for crawlers."""
    import re
    from app.models.listing import Listing, ListingStatus
    from app.models.category import Category
    from app.storage import resolve_image_url

    base = settings.site_url or "https://marketplace.aw"
    title = "Marketplace.aw — Buy & Sell Locally in Aruba"
    desc = "The local marketplace for Aruba. Buy and sell products, services, and more."
    image = f"{base}/og-image.jpg"
    og_type = "website"
    json_ld = ""

    # Homepage
    if path == "/":
        json_ld = json.dumps({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Marketplace.aw",
            "url": base,
            "description": "Aruba's local marketplace. Buy and sell anything on the island — no fees, no fuss.",
            "potentialAction": {
                "@type": "SearchAction",
                "target": f"{base}/listings?q={{search_term_string}}",
                "query-input": "required name=search_term_string",
            },
        })

    # Listing detail: /listings/<public_id>
    listing_match = re.match(r"^/listings/([A-Za-z0-9_-]+)$", path)
    if listing_match:
        pid = listing_match.group(1)
        listing = db.query(Listing).filter(Listing.public_id == pid).first()
        if listing:
            title = f"{listing.title} — AWG {listing.price} | Marketplace.aw"
            desc = (listing.description or "")[:200]
            if listing.images:
                image = resolve_image_url(listing.images[0], settings) or image
            og_type = "product"
            json_ld = json.dumps({
                "@context": "https://schema.org",
                "@type": "Product",
                "name": listing.title,
                "description": listing.description,
                "image": [resolve_image_url(img, settings) for img in listing.images],
                "offers": {
                    "@type": "Offer",
                    "price": str(listing.price),
                    "priceCurrency": "AWG",
                    "availability": "https://schema.org/InStock" if listing.status == ListingStatus.ACTIVE else "https://schema.org/SoldOut",
                },
            })

    # Category listing: /listings?category=<slug>
    elif path.startswith("/listings"):
        from urllib.parse import urlparse, parse_qs
        qs = parse_qs(urlparse(path).query)
        cat_slug = qs.get("category", [None])[0]
        if cat_slug:
            cat = db.query(Category).filter(Category.slug == cat_slug).first()
            if cat:
                title = f"{cat.name} for Sale in Aruba — Buy & Sell on Marketplace.aw"
                desc = f"Browse {cat.name} for sale in Aruba. New and second-hand — no fees, local deals on Marketplace.aw."
        else:
            title = "Buy & Sell in Aruba — Marketplace.aw"
            desc = "Browse all listings for sale in Aruba. No fees, just great local deals on Marketplace.aw."

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{image}">
<meta property="og:type" content="{og_type}">
<meta property="og:url" content="{base}{path}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<link rel="canonical" href="{base}{path}">
<link rel="alternate" hreflang="en" href="{base}{path}">
<link rel="alternate" hreflang="es" href="{base}{path}">
<link rel="alternate" hreflang="x-default" href="{base}{path}">
{f'<script type="application/ld+json">{json_ld}</script>' if json_ld else ''}
</head>
<body>
<h1>{title}</h1>
<p>{desc}</p>
<a href="{base}{path}">View on Marketplace.aw</a>
</body>
</html>"""
    return HTMLResponse(content=html)


@app.get("/api/sitemap.xml")
def sitemap(db: Session = Depends(get_db)):
    from app.models.listing import Listing, ListingStatus
    from app.models.category import Category
    base = settings.site_url or "https://marketplace.aw"
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
             f'  <url><loc>{base}/</loc><priority>1.0</priority></url>',
             f'  <url><loc>{base}/listings</loc><priority>0.9</priority></url>']
    # Categories
    for cat in db.query(Category).all():
        lines.append(f'  <url><loc>{base}/listings?category={cat.slug}</loc><priority>0.7</priority></url>')
    # Active listings
    for listing in db.query(Listing).filter(Listing.status == ListingStatus.ACTIVE).all():
        lines.append(f'  <url><loc>{base}/listings/{listing.public_id}</loc><priority>0.8</priority></url>')
    lines.append('</urlset>')
    return Response(content="\n".join(lines), media_type="application/xml")


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})


_UPLOADS_DIR = pathlib.Path(__file__).parent / "uploads" / "images"
_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
if not settings.objectstore_enabled:
    app.mount("/images", StaticFiles(directory=str(_UPLOADS_DIR)), name="images")
