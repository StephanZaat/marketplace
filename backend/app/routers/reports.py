from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.listing import Listing
from app.models.report import Report
from app.models.user import User
from app.resolve import resolve_public_id
from app.routers.auth import get_optional_user

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_REASONS = {"spam", "offensive", "scam", "wrong_category", "already_sold", "other"}


class ReportCreate(BaseModel):
    reason: str
    details: Optional[str] = None


@router.post("/listings/{listing_id}", status_code=201)
def report_listing(
    listing_id: str,
    data: ReportCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if data.reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail="Invalid reason")

    report = Report(
        listing_id=listing.id,
        reporter_id=current_user.id if current_user else None,
        reason=data.reason,
        details=data.details,
    )
    db.add(report)
    db.commit()
    return {"message": "Report submitted. Thank you."}
