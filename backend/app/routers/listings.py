from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.models.listing import Listing, ListingStatus
from app.models.message import Conversation
from app.models.user import User
from app.models.category import Category
from app.models.rating import Rating
from app.resolve import resolve_public_id, _build_pid_map, listing_to_public_dict
from app.routers.auth import get_current_user, get_optional_user
from app.schemas.listing import ListingCreate, ListingUpdate, ListingOut, ListingDetail
from app.storage import save_listing_image, delete_listing_image, resolve_image_url, _key_from_url

router = APIRouter(prefix="/listings", tags=["listings"])
settings = get_settings()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    listing_count = db.query(func.count(Listing.id)).filter(
        Listing.status == ListingStatus.ACTIVE
    ).scalar()
    seller_count = db.query(func.count(func.distinct(Listing.seller_id))).filter(
        Listing.status == ListingStatus.ACTIVE
    ).scalar()
    # Round down to nearest 10, minimum 1 if any exist
    def round10(n: int) -> int:
        if n == 0:
            return 0
        rounded = (n // 10) * 10
        return rounded if rounded > 0 else n
    return {
        "active_listings": round10(listing_count),
        "active_sellers": round10(seller_count),
    }


@router.get("/category-counts")
def category_counts(
    q: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    condition: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Return per-category listing counts for the given search filters (no category filter)."""
    query = db.query(Listing.category_id, func.count(Listing.id).label("cnt")).filter(
        Listing.status.in_([ListingStatus.ACTIVE, ListingStatus.RESERVED])
    )
    if q:
        query = query.filter(
            Listing.title.ilike(f"%{q}%") | Listing.description.ilike(f"%{q}%")
        )
    if min_price is not None:
        query = query.filter(Listing.price >= min_price)
    if max_price is not None:
        query = query.filter(Listing.price <= max_price)
    if condition:
        query = query.filter(Listing.condition == condition)
    if location:
        query = query.filter(Listing.location.ilike(f"%{location}%"))

    rows = query.group_by(Listing.category_id).all()
    # Map category_id -> count
    id_counts: dict[int, int] = {r.category_id: r.cnt for r in rows}

    # Roll up through category tree so each node shows sum of itself + all descendants
    all_cats = db.query(Category).all()
    children_map: dict[int, list[int]] = {}
    for c in all_cats:
        if c.parent_id is not None:
            children_map.setdefault(c.parent_id, []).append(c.id)

    def rollup(cid: int) -> int:
        total = id_counts.get(cid, 0)
        for child in children_map.get(cid, []):
            total += rollup(child)
        return total

    return {c.slug: rollup(c.id) for c in all_cats}


@router.get("", response_model=List[ListingOut])
def list_listings(
    request: Request,
    category: Optional[str] = None,
    q: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    condition: Optional[str] = None,
    location: Optional[str] = None,
    seller_id: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = Query(None, pattern="^(price|date|views)$"),
    sort_dir: Optional[str] = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    # Resolve seller public_id to internal id
    internal_seller_id = None
    if seller_id:
        seller = db.query(User).filter(User.public_id == seller_id).first()
        if seller:
            internal_seller_id = seller.id

    # When seller_id is provided with an explicit status, filter by that status;
    # otherwise show active + reserved listings (reserved items are still browsable)
    if internal_seller_id and status:
        try:
            status_enum = ListingStatus[status.upper()]
        except KeyError:
            status_enum = ListingStatus.ACTIVE
        query = db.query(Listing).filter(Listing.status == status_enum)
    else:
        query = db.query(Listing).filter(
            Listing.status.in_([ListingStatus.ACTIVE, ListingStatus.RESERVED])
        )

    if category:
        cat = db.query(Category).filter(Category.slug == category).first()
        if cat:
            # Collect IDs of this category and all descendants
            all_cats = db.query(Category).all()
            children_map: dict[int, list[int]] = {}
            for c in all_cats:
                if c.parent_id is not None:
                    children_map.setdefault(c.parent_id, []).append(c.id)

            def collect_ids(cid: int) -> list[int]:
                ids = [cid]
                for child_id in children_map.get(cid, []):
                    ids.extend(collect_ids(child_id))
                return ids

            cat_ids = collect_ids(cat.id)
            query = query.filter(Listing.category_id.in_(cat_ids))

    if q:
        query = query.filter(
            Listing.title.ilike(f"%{q}%") | Listing.description.ilike(f"%{q}%")
        )
    if min_price is not None:
        query = query.filter(Listing.price >= min_price)
    if max_price is not None:
        query = query.filter(Listing.price <= max_price)
    if condition:
        query = query.filter(Listing.condition == condition)
    if location:
        query = query.filter(Listing.location.ilike(f"%{location}%"))
    # Attribute filters: any query param starting with "attr_" is treated as attributes.<key>=value
    from sqlalchemy import cast
    from sqlalchemy.dialects.postgresql import JSONB
    for key, value in request.query_params.items():
        if key.startswith("attr_") and value:
            attr_key = key[5:]  # strip "attr_"
            query = query.filter(
                cast(Listing.attributes, JSONB)[attr_key].astext == value
            )
    if internal_seller_id:
        query = query.filter(Listing.seller_id == internal_seller_id)

    from sqlalchemy import asc, desc
    col_map = {"price": Listing.price, "views": Listing.view_count, "date": Listing.created_at}
    sort_col = col_map.get(sort_by or "date", Listing.created_at)
    order_fn = asc if sort_dir == "asc" else desc
    rows = query.order_by(order_fn(sort_col)).offset(skip).limit(limit).all()

    # Enrich with seller location + category info in bulk queries (no N+1)
    seller_ids = {r.seller_id for r in rows}
    cat_ids    = {r.category_id for r in rows}
    sellers    = {u.id: u for u in db.query(User).filter(User.id.in_(seller_ids)).all()} if seller_ids else {}
    cats       = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}

    # Build public_id maps for FK resolution
    seller_pid_map = _build_pid_map(db, User, seller_ids)
    cat_pid_map = _build_pid_map(db, Category, cat_ids)

    # Bulk fetch seller avg ratings
    seller_ratings: dict = {}
    if seller_ids:
        rating_rows = (
            db.query(Rating.ratee_id, Rating.score_description, Rating.score_communication, Rating.score_exchange)
            .filter(Rating.ratee_id.in_(seller_ids), Rating.role == "buyer_rating_seller")
            .all()
        )
        from collections import defaultdict
        by_seller: dict = defaultdict(list)
        for row in rating_rows:
            by_seller[row.ratee_id].append((row.score_description + row.score_communication + row.score_exchange) / 3.0)
        for sid, scores in by_seller.items():
            seller_ratings[sid] = round(sum(scores) / len(scores), 1)

    results = []
    for r in rows:
        d = {c.key: getattr(r, c.key) for c in r.__table__.columns}
        s = sellers.get(r.seller_id)
        c = cats.get(r.category_id)
        d["id"] = d.pop("public_id")
        d["seller_id"] = seller_pid_map.get(r.seller_id, "")
        d["category_id"] = cat_pid_map.get(r.category_id, "")
        d["seller_location"]   = s.location if s else None
        d["seller_languages"]  = s.languages if s else None
        d["seller_avg_rating"] = seller_ratings.get(r.seller_id)
        d["category_icon"]     = c.icon if c else None
        d["category_name"]     = c.name if c else None
        d["category_name_es"]  = c.name_es if c else None
        d["images"] = [resolve_image_url(img, settings) for img in (d.get("images") or [])]
        results.append(d)
    return results


@router.get("/{listing_id}", response_model=ListingDetail)
def get_listing(
    listing_id: str,
    no_track: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")

    # Increment view count for non-owner views, unless client signals already tracked
    if not no_track and (not current_user or current_user.id != listing.seller_id):
        listing.view_count = (listing.view_count or 0) + 1
        db.commit()

    seller = db.query(User).filter(User.id == listing.seller_id).first()
    category = db.query(Category).filter(Category.id == listing.category_id).first()
    parent_cat = db.query(Category).filter(Category.id == category.parent_id).first() if category and category.parent_id else None

    # Build seller contact info -- only expose email/phone if seller opted in
    methods = {m.strip() for m in (seller.contact_method or "").split(",") if m.strip()} if seller else set()
    seller_data = {c.key: getattr(seller, c.key) for c in seller.__table__.columns} if seller else {}
    seller_data["id"] = seller_data.pop("public_id", "")
    seller_data["email"] = seller.email if "email" in methods else None
    seller_data["phone"] = seller.phone if "phone" in methods else None

    # Compute seller avg rating
    if seller:
        rating_rows = (
            db.query(Rating.score_description, Rating.score_communication, Rating.score_exchange)
            .filter(Rating.ratee_id == seller.id, Rating.role == "buyer_rating_seller")
            .all()
        )
        if rating_rows:
            scores = [(r.score_description + r.score_communication + r.score_exchange) / 3.0 for r in rating_rows]
            seller_data["avg_rating"] = round(sum(scores) / len(scores), 1)
            seller_data["rating_count"] = len(scores)
        else:
            seller_data["avg_rating"] = None
            seller_data["rating_count"] = 0

    from app.models.favorite import Favorite
    favorite_count = db.query(Favorite).filter(Favorite.listing_id == listing.id).count()

    # Build public ID maps for FKs
    seller_pid_map = _build_pid_map(db, User, {listing.seller_id})
    cat_pid_map = _build_pid_map(db, Category, {listing.category_id})

    data = {c.key: getattr(listing, c.key) for c in listing.__table__.columns}
    data["id"] = data.pop("public_id")
    data["seller_id"] = seller_pid_map.get(listing.seller_id, "")
    data["category_id"] = cat_pid_map.get(listing.category_id, "")
    data["images"] = [resolve_image_url(img, settings) for img in (data.get("images") or [])]
    data["favorite_count"] = favorite_count
    seller_data["avatar_url"] = resolve_image_url(seller_data.get("avatar_url"), settings)
    data["seller"] = seller_data
    # Attach parent info to category dict so CategoryOut.parent gets populated
    cat_data = {c.key: getattr(category, c.key) for c in category.__table__.columns} if category else {}
    if category:
        cat_data["id"] = cat_data.pop("public_id", "")
        if cat_data.get("parent_id"):
            parent_pid_map = _build_pid_map(db, Category, {cat_data["parent_id"]})
            cat_data["parent_id"] = parent_pid_map.get(cat_data["parent_id"])
        else:
            cat_data["parent_id"] = None
    if parent_cat:
        parent_data = {c.key: getattr(parent_cat, c.key) for c in parent_cat.__table__.columns}
        parent_data["id"] = parent_data.pop("public_id", "")
        cat_data["parent"] = parent_data
    data["category"] = cat_data
    return ListingDetail.model_validate(data)


@router.post("", response_model=ListingOut, status_code=201)
@limiter.limit("20/hour")
def create_listing(
    request: Request,
    data: ListingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve category public_id to internal id
    cat = resolve_public_id(db, Category, data.category_id, "Category")
    listing = Listing(
        **data.model_dump(exclude={"category_id"}),
        category_id=cat.id,
        seller_id=current_user.id,
        images=[],
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    from app import email as mail
    background_tasks.add_task(mail.send_new_listing, current_user, listing, cat.name)

    return listing_to_public_dict(listing, db)


@router.patch("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: str,
    data: ListingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")

    update_data = data.model_dump(exclude_none=True, exclude={"sold_to_conversation_id", "category_id"})
    for field, value in update_data.items():
        setattr(listing, field, value)

    # Resolve category_id if provided
    if data.category_id is not None:
        cat = resolve_public_id(db, Category, data.category_id, "Category")
        listing.category_id = cat.id

    if data.sold_to_conversation_id is not None:
        conv = resolve_public_id(db, Conversation, data.sold_to_conversation_id, "Conversation")
        if conv.listing_id != listing.id or conv.seller_id != current_user.id:
            raise HTTPException(status_code=400, detail="Invalid conversation for this listing")
        conv.is_sold_to = True

    db.commit()
    db.refresh(listing)
    return listing_to_public_dict(listing, db)


@router.delete("/{listing_id}", status_code=204)
def delete_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    # Soft-delete: set status to INACTIVE (preserved for admin archive)
    listing.status = ListingStatus.INACTIVE
    db.commit()


@router.post("/{listing_id}/renew", response_model=ListingOut)
def renew_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Renew an active or expired listing, resetting the 30-day inactivity timer."""
    from datetime import datetime, timezone
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    if listing.status not in (ListingStatus.ACTIVE, ListingStatus.EXPIRED):
        raise HTTPException(status_code=400, detail="Only active or expired listings can be renewed")
    listing.status = ListingStatus.ACTIVE
    listing.updated_at = datetime.now(timezone.utc)
    listing.reminder_sent = False
    db.commit()
    db.refresh(listing)
    return listing_to_public_dict(listing, db)


@router.post("/{listing_id}/images", response_model=ListingOut)
@limiter.limit("60/hour")
def upload_image(
    request: Request,
    listing_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    if len(listing.images) >= 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images per listing")
    key = save_listing_image(file, listing.id, settings)
    listing.images = listing.images + [key]
    db.commit()
    db.refresh(listing)
    d = listing_to_public_dict(listing, db)
    d["images"] = [resolve_image_url(img, settings) for img in (d.get("images") or [])]
    return d


@router.delete("/{listing_id}/images", response_model=ListingOut)
def delete_image(
    listing_id: str,
    image_url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    # Accept either a full URL or a relative key from the client
    key = _key_from_url(image_url, settings)
    if key not in listing.images:
        raise HTTPException(status_code=404, detail="Image not found")
    updated = list(listing.images)
    updated.remove(key)
    if key not in updated:
        delete_listing_image(key, settings)
    listing.images = updated
    db.commit()
    db.refresh(listing)
    d = listing_to_public_dict(listing, db)
    d["images"] = [resolve_image_url(img, settings) for img in (d.get("images") or [])]
    return d
