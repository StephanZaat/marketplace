from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category_alert import CategoryAlert
from app.models.category import Category
from app.resolve import _build_pid_map
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/categories", response_model=List[str])
def get_category_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the list of category public IDs the current user has alerts for."""
    rows = db.query(CategoryAlert).filter(CategoryAlert.user_id == current_user.id).all()
    cat_ids = {r.category_id for r in rows}
    if not cat_ids:
        return []
    pid_map = _build_pid_map(db, Category, cat_ids)
    return [pid_map[r.category_id] for r in rows if r.category_id in pid_map]


@router.put("/categories", response_model=List[str])
def set_category_alerts(
    category_ids: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replace the user's category alert subscriptions with the given list."""
    # Resolve public IDs to internal IDs
    internal_ids = []
    if category_ids:
        cats = db.query(Category).filter(Category.public_id.in_(category_ids)).all()
        internal_ids = [c.id for c in cats]

    # Delete existing then insert new (simple replace)
    db.query(CategoryAlert).filter(CategoryAlert.user_id == current_user.id).delete()
    for cid in internal_ids:
        db.add(CategoryAlert(user_id=current_user.id, category_id=cid))
    db.commit()

    # Return the public IDs of what was saved
    pid_map = _build_pid_map(db, Category, set(internal_ids))
    return [pid_map[cid] for cid in internal_ids if cid in pid_map]
