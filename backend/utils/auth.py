"""
utils/auth.py
=============
Authentication utilities for the FastAPI backend.

Provides the ``get_current_user`` dependency that verifies Firebase ID tokens
sent by the frontend and resolves them to a user record in MongoDB.

The previous DEFAULT_GUEST_USER fallback has been removed — all protected
endpoints now require a valid Firebase token.
"""

from datetime import datetime, timezone, timedelta
import logging

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

import bcrypt as _bcrypt

from backend.config import get_settings
from backend.database import get_database
from backend.utils.firebase_init import verify_firebase_token
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# HTTP Bearer scheme — expects "Authorization: Bearer <firebase_id_token>"
# auto_error=False so we can return a clear 401 message ourselves.
_bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# JWT utilities (for email/password accounts and local sessions)
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token for local authentication."""
    settings = get_settings()
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# ---------------------------------------------------------------------------
# Password utilities (retained for email/password accounts)
# ---------------------------------------------------------------------------

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


from pymongo.errors import PyMongoError, DuplicateKeyError

# ---------------------------------------------------------------------------
# Firebase-verified user resolution
# ---------------------------------------------------------------------------

async def _get_or_create_firebase_user(verified_claims: dict, db) -> dict:
    """Find an existing user by firebase_uid or create a new one.

    Returns a user dict with ``_id`` as a string.
    """
    firebase_uid = verified_claims["uid"]
    email = verified_claims.get("email", "").lower()

    # 1. Try finding by firebase_uid (canonical lookup)
    user = await db.users.find_one({"firebase_uid": firebase_uid})

    # 2. Fallback: find by email if firebase_uid not stored yet
    if not user and email:
        user = await db.users.find_one({"email": email})
        if user:
            # Backfill firebase_uid onto the existing record
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"firebase_uid": firebase_uid}},
            )

    # 3. Auto-create user record for first-time Firebase-authenticated users
    if not user:
        now = datetime.now(timezone.utc)
        name = verified_claims.get("name") or (email.split("@")[0] if email else "User")
        provider = verified_claims.get("firebase", {}).get("sign_in_provider", "firebase")
        avatar_url = verified_claims.get("picture", None)
        user_doc = {
            "name": name,
            "email": email,
            "firebase_uid": firebase_uid,
            "provider": provider,
            "avatar_url": avatar_url,
            "hashed_password": None,
            "created_at": now,
        }
        try:
            result = await db.users.insert_one(user_doc)
            user_doc["_id"] = str(result.inserted_id)
            user = user_doc
        except (DuplicateKeyError, PyMongoError) as ins_err:
            logger.info("Concurrent user creation detected or unique index match; querying record: %s", ins_err)
            # Fetch the record inserted concurrently
            user = await db.users.find_one({"firebase_uid": firebase_uid})
            if not user and email:
                user = await db.users.find_one({"email": email})
            if not user:
                logger.error("Failed to insert or find user for claims: %s", verified_claims)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to resolve user account.",
                )

        # Create or update default profile and settings idempotently
        user_id = str(user.get("_id", user.get("id", "")))
        try:
            await db.profiles.update_one(
                {"user_id": user_id},
                {"$setOnInsert": {
                    "user_id": user_id,
                    "name": name,
                    "email": email,
                    "avatar_url": avatar_url,
                    "bio": None,
                    "phone": None,
                    "location": None,
                    "updated_at": now,
                }},
                upsert=True,
            )
            await db.settings.update_one(
                {"user_id": user_id},
                {"$setOnInsert": {
                    "user_id": user_id,
                    "theme": "dark",
                    "language": "en",
                    "notifications_enabled": True,
                    "default_city": "Latur",
                    "updated_at": now,
                }},
                upsert=True,
            )
        except Exception as profile_err:
            logger.warning("Profile/settings initialisation warning: %s", profile_err)

    else:
        # Update missing fields if needed
        update_fields = {}
        if not user.get("firebase_uid"):
            update_fields["firebase_uid"] = firebase_uid
        if verified_claims.get("picture") and not user.get("avatar_url"):
            update_fields["avatar_url"] = verified_claims["picture"]
        if update_fields:
            try:
                await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
            except Exception as e:
                logger.warning("Failed to update user details: %s", e)

    # Normalise _id to string
    user["_id"] = str(user.get("_id", user.get("id", "")))
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    return user


# ---------------------------------------------------------------------------
# Dev-only bypass user (only used when DEV_SKIP_AUTH=true in non-production)
# ---------------------------------------------------------------------------

_DEV_USER = {
    "_id": "dev_user_local",
    "name": "Dev User",
    "email": "dev@localhost",
    "firebase_uid": "dev_uid_local",
    "created_at": datetime.now(timezone.utc),
}


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    """FastAPI dependency: verify Firebase ID token or local JWT access token and return user.

    - Extracts the token from ``Authorization: Bearer <token>``
    - Verifies via Firebase Admin SDK or local JWT secret
    - Resolves or creates the user in MongoDB
    - Returns 401 if the token is missing or invalid
    """
    settings = get_settings()

    # --- Dev bypass (strictly local dev only) --------------------------------
    if settings.DEV_SKIP_AUTH:
        logger.warning("DEV_SKIP_AUTH is enabled; bypassing authentication.")
        return _DEV_USER

    # --- Token presence -------------------------------------------------------
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = creds.credentials

    # --- 1. Attempt Firebase verification -------------------------------------
    firebase_exc = None
    try:
        verified_claims = verify_firebase_token(token)
    except ValueError as exc:
        firebase_exc = exc
        verified_claims = None

    if verified_claims is not None:
        try:
            return await _get_or_create_firebase_user(verified_claims, db)
        except PyMongoError as db_err:
            logger.error("MongoDB unavailable during get_current_user: %s", db_err)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service is temporarily unavailable.",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Failed to resolve user from Firebase claims: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to resolve user account.",
            )

    # If the token failed with explicit expiration or revocation, reject immediately
    err_str = str(firebase_exc or "")
    if "expired" in err_str.lower() or "revoked" in err_str.lower():
        logger.warning("Firebase token rejected: %s", err_str)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_str,
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- 2. Attempt Local JWT verification fallback --------------------------
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub") or payload.get("id") or payload.get("user_id")
        email = (payload.get("email") or "").lower()
        if not user_id and not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        query = {}
        if user_id:
            try:
                query = {"_id": ObjectId(user_id)}
            except Exception:
                query = {"_id": user_id}
        elif email:
            query = {"email": email}

        try:
            user = await db.users.find_one(query)
            if not user and email:
                user = await db.users.find_one({"email": email})
        except PyMongoError as db_err:
            logger.error("MongoDB unavailable during get_current_user JWT lookup: %s", db_err)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service is temporarily unavailable.",
            )


        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account no longer exists.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user["_id"] = str(user.get("_id", user.get("id", "")))
        if isinstance(user.get("created_at"), str):
            user["created_at"] = datetime.fromisoformat(user["created_at"])
        return user

    except (JWTError, HTTPException) as jwt_err:
        if isinstance(jwt_err, HTTPException):
            raise jwt_err
        logger.warning("Token verification failed (Firebase: %s, JWT: %s)", firebase_exc, jwt_err)
        detail_msg = err_str or "Invalid authentication token. Please sign in again."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail_msg,
            headers={"WWW-Authenticate": "Bearer"},
        )
