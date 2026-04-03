import hashlib
import os
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.limiter import limiter
from app.models.user import User
from app.schemas.user import OtpSendRequest, OtpSendResponse, OtpVerifyRequest, UserMe, Token
from app.storage import resolve_image_url

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# ── Rate limiting state ────────────────────────────────────────────────────────

_otp_rate_lock = Lock()
_otp_rate: dict[str, list[float]] = defaultdict(list)
_OTP_WINDOW = 300  # 5 minutes
_OTP_MAX = 5


def _check_email_rate_limit(email: str) -> None:
    now = time.monotonic()
    key = email.lower().strip()
    with _otp_rate_lock:
        # Periodic cleanup: purge stale entries every 100 calls
        if len(_otp_rate) > 1000:
            stale = [k for k, ts in _otp_rate.items() if not ts or now - ts[-1] > _OTP_WINDOW]
            for k in stale:
                del _otp_rate[k]
        timestamps = _otp_rate[key]
        timestamps[:] = [t for t in timestamps if now - t < _OTP_WINDOW]
        if len(timestamps) >= _OTP_MAX:
            raise HTTPException(
                status_code=429,
                detail="Too many OTP requests. Try again in a few minutes.",
            )
        timestamps.append(now)


# ── OTP helpers ────────────────────────────────────────────────────────────────

def _create_otp_code() -> str:
    dev_code = os.environ.get("DEV_OTP_CODE")
    if dev_code:
        return dev_code
    return f"{secrets.randbelow(1000000):06d}"


def _create_otp_token(email: str, code: str) -> str:
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    return jwt.encode(
        {"sub": email, "purpose": "otp", "code_hash": code_hash, "exp": expire},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def _verify_otp_token(token: str, code: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("purpose") != "otp":
        return None
    expected_hash = hashlib.sha256(code.encode()).hexdigest()
    if payload.get("code_hash") != expected_hash:
        return None
    return payload.get("sub")


# ── Auth helpers ───────────────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exc
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise credentials_exc
    return user


def get_optional_user(token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = int(payload.get("sub"))
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except Exception:
        return None


# ── OTP endpoints ──────────────────────────────────────────────────────────────

@router.post("/otp-send", response_model=OtpSendResponse)
@limiter.limit("5/minute")
async def otp_send(request: Request, data: OtpSendRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    from app.captcha import verify_captcha
    if not verify_captcha(data.frc_captcha_response):
        raise HTTPException(status_code=400, detail="Captcha verification failed")
    _check_email_rate_limit(data.email)

    is_new_user = db.query(User).filter(User.email == data.email).first() is None

    code = _create_otp_code()
    otp_token = _create_otp_token(data.email, code)

    from app import email as mail
    background_tasks.add_task(mail.send_otp_code, data.email, code)

    return OtpSendResponse(otp_token=otp_token, is_new_user=is_new_user)


@router.post("/otp-verify", response_model=Token)
@limiter.limit("10/minute")
def otp_verify(request: Request, data: OtpVerifyRequest, db: Session = Depends(get_db)):
    email = _verify_otp_token(data.otp_token, data.code)
    if not email or email.lower() != data.email.lower():
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        name = data.full_name or email.split("@")[0]
        user = User(email=email, full_name=name, is_verified=True)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account disabled")
        if not user.is_verified:
            user.is_verified = True
            db.commit()

    return Token(access_token=create_access_token(user.id))


# ── Me ─────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserMe)
def me(current_user: User = Depends(get_current_user)):
    d = {c.key: getattr(current_user, c.key) for c in current_user.__table__.columns}
    d["id"] = d.pop("public_id")
    d["avatar_url"] = resolve_image_url(d.get("avatar_url"), settings)
    return UserMe.model_validate(d)
