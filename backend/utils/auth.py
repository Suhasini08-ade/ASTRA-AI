"""
utils/auth.py
=============
JWT token management and password hashing utilities.
Provides the `get_current_user` dependency for protected routes.
"""

from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt as _bcrypt

from backend.config import get_settings
from backend.database import get_database
from backend.utils.local_auth_store import find_user_by_id

# OAuth2 scheme — expects "Authorization: Bearer <token>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Optional OAuth2 scheme — does NOT auto-raise 401 when token is absent.
# Used for routes that should return empty data gracefully for unauthenticated users.
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = _bcrypt.gensalt()
    return _bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return _bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    """Create a signed JWT access token."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


DEFAULT_GUEST_USER = {
    "_id": "guest_user_default_id",
    "name": "Guest User",
    "email": "guest@nexus.ai",
    "created_at": datetime.now(timezone.utc),
}


async def get_current_user(
    token: str | None = Depends(oauth2_scheme_optional),
) -> dict:
    """
    FastAPI dependency: decode the JWT, look up the user in MongoDB or local store.
    Returns DEFAULT_GUEST_USER if no token or an invalid token is provided.
    """
    if not token:
        return DEFAULT_GUEST_USER

    settings = get_settings()
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            return DEFAULT_GUEST_USER
    except JWTError:
        return DEFAULT_GUEST_USER

    try:
        db = get_database()
    except RuntimeError:
        db = None

    try:
        if db and ObjectId.is_valid(user_id):
            user = await db.users.find_one({"_id": ObjectId(user_id)})
        else:
            user = find_user_by_id(user_id)
    except Exception:
        return DEFAULT_GUEST_USER

    if user is None:
        return DEFAULT_GUEST_USER

    # Convert ObjectId to string for downstream use
    user["_id"] = str(user.get("_id", user.get("id")))
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    return user


async def optional_get_current_user(
    token: str | None = Depends(oauth2_scheme_optional),
) -> dict:
    """FastAPI dependency: returns current user or DEFAULT_GUEST_USER."""
    return await get_current_user(token)
