"""
Admin authentication: username/password + optional TOTP 2FA.
Completely separate from regular user auth (separate admins table, separate JWT tokens).
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.models.admin import Admin
from app.schemas.admin import AdminOut, AdminToken, TotpSetupOut, TotpVerifyIn

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])
settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/admin/auth/token")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8   # 8 hours
PREAUTH_TOKEN_EXPIRE_MINUTES = 5       # 5-minute window for TOTP step


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expire_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=ALGORITHM)


def get_current_admin(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> Admin:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise credentials_exc
        if payload.get("stage") == "pre-auth":
            raise credentials_exc
    except JWTError:
        raise credentials_exc
    admin = db.query(Admin).filter(Admin.username == username).first()
    if admin is None:
        raise credentials_exc
    return admin


def get_preauth_admin(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> Admin:
    """For TOTP step-2: only accepts pre-auth tokens."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired pre-auth token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username or payload.get("stage") != "pre-auth":
            raise credentials_exc
    except JWTError:
        raise credentials_exc
    admin = db.query(Admin).filter(Admin.username == username).first()
    if admin is None:
        raise credentials_exc
    return admin


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/token", response_model=AdminToken)
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    """Step 1: verify credentials. Returns pre-auth token if TOTP is enabled."""
    admin = db.query(Admin).filter(Admin.username == form_data.username).first()
    if not admin or not verify_password(form_data.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if admin.totp_enabled:
        pre_token = create_access_token(
            {"sub": admin.username, "stage": "pre-auth"},
            expire_minutes=PREAUTH_TOKEN_EXPIRE_MINUTES,
        )
        return AdminToken(access_token=pre_token, totp_required=True)
    return AdminToken(access_token=create_access_token({"sub": admin.username}))


@router.post("/totp/verify", response_model=AdminToken)
@limiter.limit("5/minute")
def totp_verify(
    request: Request,
    body: TotpVerifyIn,
    admin: Annotated[Admin, Depends(get_preauth_admin)],
):
    """Step 2: verify TOTP code, return full access token."""
    if not admin.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP not configured")
    totp = pyotp.TOTP(admin.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    return AdminToken(access_token=create_access_token({"sub": admin.username}))


@router.get("/totp/setup", response_model=TotpSetupOut)
def totp_setup(
    admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    if not admin.totp_secret:
        admin.totp_secret = pyotp.random_base32()
        db.commit()
        db.refresh(admin)
    totp = pyotp.TOTP(admin.totp_secret)
    qr_uri = totp.provisioning_uri(name=admin.username, issuer_name="Marketplace.aw")
    return TotpSetupOut(qr_uri=qr_uri, secret=admin.totp_secret, enabled=admin.totp_enabled)


@router.post("/totp/enable")
@limiter.limit("5/minute")
def totp_enable(
    request: Request,
    body: TotpVerifyIn,
    admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    if not admin.totp_secret:
        raise HTTPException(status_code=400, detail="Call /totp/setup first")
    totp = pyotp.TOTP(admin.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    admin.totp_enabled = True
    db.commit()
    return {"detail": "2FA enabled"}


@router.post("/totp/disable")
@limiter.limit("5/minute")
def totp_disable(
    request: Request,
    body: TotpVerifyIn,
    admin: Annotated[Admin, Depends(get_current_admin)],
    db: Session = Depends(get_db),
):
    if not admin.totp_secret or not admin.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    totp = pyotp.TOTP(admin.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    admin.totp_secret = None
    admin.totp_enabled = False
    db.commit()
    return {"detail": "2FA disabled"}


@router.get("/me", response_model=AdminOut)
def me(current_admin: Annotated[Admin, Depends(get_current_admin)]):
    return current_admin
