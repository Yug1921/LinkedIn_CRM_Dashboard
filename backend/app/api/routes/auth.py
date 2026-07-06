"""
Auth routes for GoTeeOff CRM
─────────────────────────────
No public sign-up. Access is invite-only:

  1. Admin calls POST /auth/invite  → gets a 48-h signed invite link
  2. Invitee opens /invite?token=…  → sets password via POST /auth/register
  3. Everyone logs in via POST /auth/login
     → access token (body, 7-day) + refresh token (httpOnly cookie, 30-day)
  4. POST /auth/refresh silently renews the access token
  5. POST /auth/logout clears the cookie

Deps this adds (append to requirements.txt):
    python-jose[cryptography]==3.3.0
    passlib[bcrypt]==1.7.4
    python-multipart==0.0.9

Env vars needed (add to .env / .env.example):
    SECRET_KEY=<long-random-string>          # already in your config
    FRONTEND_URL=http://localhost:3000
"""

from __future__ import annotations

import secrets
import uuid
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["auth"])

# ── crypto ────────────────────────────────────────────────────────────────────


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

_ALGO = "HS256"
_ACCESS_EXP_MIN = 60 * 24 * 7      # 7 days
_REFRESH_EXP_DAYS = 30
_INVITE_EXP_HOURS = 48

# ── schemas ───────────────────────────────────────────────────────────────────

from pydantic import field_validator

class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    is_admin: bool

    class Config:
        from_attributes = True

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v):
        return str(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class InviteRequest(BaseModel):
    email: EmailStr
    full_name: str
    is_admin: bool = False


class InviteResponse(BaseModel):
    invite_link: str
    invite_token: str


class RegisterRequest(BaseModel):
    invite_token: str
    password: str


# ── helpers ───────────────────────────────────────────────────────────────────

def _hash(password: str) -> str:
    # bcrypt has a hard 72-byte limit on input — truncate defensively
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")

def _verify(plain: str, hashed: str) -> bool:
    pw_bytes = plain.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except ValueError:
        return False

def _make_access_token(user_id: str, is_admin: bool) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_EXP_MIN)
    return jwt.encode(
        {"sub": user_id, "is_admin": is_admin, "exp": exp, "type": "access"},
        settings.SECRET_KEY, algorithm=_ALGO,
    )

def _make_refresh_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=_REFRESH_EXP_DAYS)
    return jwt.encode(
        {"sub": user_id, "exp": exp, "type": "refresh"},
        settings.SECRET_KEY, algorithm=_ALGO,
    )

def _make_invite_token(email: str, full_name: str, is_admin: bool) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=_INVITE_EXP_HOURS)
    return jwt.encode(
        {
            "email": email, "full_name": full_name, "is_admin": is_admin,
            "exp": exp, "type": "invite",
            "jti": secrets.token_hex(8),   # one-time nonce
        },
        settings.SECRET_KEY, algorithm=_ALGO,
    )

def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALGO])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token",
                            headers={"WWW-Authenticate": "Bearer"})

def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=settings.APP_ENV == "production",
        # Cross-domain Vercel→Render requires samesite="none" (secure cookies).
        # Local dev (http) falls back to "lax" because "none" requires secure=True.
        samesite="none" if settings.APP_ENV == "production" else "lax",
        max_age=_REFRESH_EXP_DAYS * 86_400,
    )

# ── current-user dependency ───────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = _decode(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Wrong token type")
    user = db.query(User).filter(
        User.id == payload["sub"], User.is_active == True
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    if not user or not _verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    access = _make_access_token(str(user.id), user.is_admin)
    refresh = _make_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh)

    return TokenResponse(access_token=access, user=UserOut.from_orm(user))


@router.post("/refresh")
def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = _decode(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Wrong token type")

    user = db.query(User).filter(
        User.id == payload["sub"], User.is_active == True
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_refresh = _make_refresh_token(str(user.id))
    _set_refresh_cookie(response, new_refresh)
    return {
        "access_token": _make_access_token(str(user.id), user.is_admin),
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token", path="/auth/refresh")
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.from_orm(current_user)


@router.post("/invite", response_model=InviteResponse, responses={403: {"description": "Admin access required"}})
def create_invite(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Admin-only: generate a 48-h invite link for a new team member."""
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    token = _make_invite_token(payload.email.lower(), payload.full_name, payload.is_admin)
    return InviteResponse(
        invite_token=token,
        invite_link=f"{settings.FRONTEND_URL}/invite?token={token}",
    )


@router.post("/register", response_model=TokenResponse)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Complete registration from an invite link."""
    claims = _decode(payload.invite_token)
    if claims.get("type") != "invite":
        raise HTTPException(status_code=400, detail="Invalid invite token")

    if db.query(User).filter(User.email == claims["email"]).first():
        raise HTTPException(status_code=400, detail="Account already exists — please log in")

    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user = User(
        id=uuid.uuid4(),
        email=claims["email"],
        full_name=claims["full_name"],
        hashed_password=_hash(payload.password),
        is_active=True,
        is_admin=claims.get("is_admin", False),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access = _make_access_token(str(user.id), user.is_admin)
    refresh = _make_refresh_token(str(user.id))
    _set_refresh_cookie(response, refresh)

    return TokenResponse(access_token=access, user=UserOut.from_orm(user))
