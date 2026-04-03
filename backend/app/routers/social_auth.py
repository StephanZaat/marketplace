"""
Social login endpoints: Google and Facebook.

Flow (both providers):
  1. Frontend obtains a token/credential from the provider's JS SDK.
  2. Frontend POSTs it to /auth/google or /auth/facebook.
  3. Backend verifies it against the provider's API.
  4. Backend upserts the user (create on first login, update on return).
  5. Backend returns a JWT identical to the normal login flow.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.models.user import User
from app.routers.auth import create_access_token
from app.schemas.user import Token

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


# ── helpers ────────────────────────────────────────────────────────────────

def _upsert_user(
    *,
    db: Session,
    email: str,
    full_name: str | None,
    avatar_url: str | None,
) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Update profile fields if they improved (e.g. now has an avatar)
        changed = False
        if full_name and not user.full_name:
            user.full_name = full_name
            changed = True
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
            changed = True
        if changed:
            db.commit()
            db.refresh(user)
        return user

    # New user — create account (no password required)
    user = User(
        email=email,
        hashed_password=None,  # social-login users have no password
        full_name=full_name,
        avatar_url=avatar_url,
        is_active=True,
        is_verified=True,     # email verified by OAuth provider
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── Google ──────────────────────────────────────────────────────────────────

class GoogleRequest(BaseModel):
    credential: str   # Google ID token from @react-oauth/google


@router.post("/google", response_model=Token)
@limiter.limit("20/minute")
async def google_login(request: Request, body: GoogleRequest, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google login not configured")

    # Verify the ID token with Google's tokeninfo endpoint
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.credential},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    info = resp.json()

    # Validate audience matches our client ID
    if info.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Google credential audience mismatch")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    user = _upsert_user(
        db=db,
        email=email,
        full_name=info.get("name"),
        avatar_url=info.get("picture"),
    )
    return Token(access_token=create_access_token(user.id))


# ── Facebook ────────────────────────────────────────────────────────────────

class FacebookRequest(BaseModel):
    access_token: str   # Facebook user access token from JS SDK


@router.post("/facebook", response_model=Token)
@limiter.limit("20/minute")
async def facebook_login(request: Request, body: FacebookRequest, db: Session = Depends(get_db)):
    if not settings.facebook_app_id:
        raise HTTPException(status_code=503, detail="Facebook login not configured")

    # Verify the token and fetch user profile from Graph API
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.facebook.com/me",
            params={
                "fields": "id,name,email,picture.type(large)",
                "access_token": body.access_token,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Facebook token")

    info = resp.json()
    if "error" in info:
        raise HTTPException(status_code=401, detail="Invalid Facebook token")

    email = info.get("email")
    if not email:
        # Facebook sometimes withholds email (e.g. phone-only accounts)
        raise HTTPException(
            status_code=400,
            detail="Facebook account has no email address. Please register with email instead.",
        )

    avatar_url = info.get("picture", {}).get("data", {}).get("url")

    user = _upsert_user(
        db=db,
        email=email,
        full_name=info.get("name"),
        avatar_url=avatar_url,
    )
    return Token(access_token=create_access_token(user.id))
