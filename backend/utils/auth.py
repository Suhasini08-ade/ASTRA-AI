"""
utils/auth.py
=============
Authentication utilities for the FastAPI backend.

Provides the ``get_current_user`` dependency that verifies Firebase ID tokens
sent by the frontend and resolves them to a user record in MongoDB.

The previous DEFAULT_GUEST_USER fallback has been removed — all protected
endpoints now require a valid Firebase token.
"""

from datetime import datetime, timezone
import logging

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import bcrypt as _bcrypt

from backend.config import get_settings
from backend.database import get_database
from backend.utils.firebase_init import verify_firebase_token

logger = logging.getLogger(__name__)

# HTTP Bearer scheme — expects "Authorization: Bearer <firebase_id_token>"
# auto_error=False so we can return a clear 401 message ourselves.
_bearer_scheme = HTTPBearer(auto_error=False)


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
        name = verified_claims.get("name") or email.split("@")[0] if email else "User"
        user_doc = {
            "name": name,
            "email": email,
            "firebase_uid": firebase_uid,
            "provider": verified_claims.get("firebase", {}).get("sign_in_provider", "firebase"),
            "avatar_url": verified_claims.get("picture", None),
            "hashed_password": None,
            "created_at": now,
        }
        result = await db.users.insert_one(user_doc)
        user_doc["_id"] = str(result.inserted_id)

        # Create default profile and settings
        user_id = user_doc["_id"]
        await db.profiles.insert_one({
            "user_id": user_id,
            "name": name,
            "email": email,
            "avatar_url": verified_claims.get("picture", None),
            "bio": None,
            "phone": None,
            "location": None,
            "updated_at": now,
        })
        await db.settings.insert_one({
            "user_id": user_id,
            "theme": "dark",
            "language": "en",
            "notifications_enabled": True,
            "default_city": "Latur",
            "updated_at": now,
        })
        return user_doc

    # Normalise _id to string
    user["_id"] = str(user.get("_id", user.get("id", "")))
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    return user


# ---------------------------------------------------------------------------
# Dev-only bypass user (only used when DEV_SKIP_AUTH=true)
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
) -> dict:
    """FastAPI dependency: verify Firebase ID token and return the user.

    - Extracts the token from ``Authorization: Bearer <token>``
    - Verifies it via Firebase Admin SDK
    - Resolves or creates the user in MongoDB
    - Returns 401 if the token is missing or invalid

    When ``DEV_SKIP_AUTH=true`` in the backend .env, authentication is
    bypassed and a static dev user is returned (local development only).
    """
    settings = get_settings()

    # --- Dev bypass -----------------------------------------------------------
    if settings.DEV_SKIP_AUTH:
        return _DEV_USER

    # --- Token presence -------------------------------------------------------
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = creds.credentials

    # --- Firebase verification ------------------------------------------------
    try:
        verified_claims = verify_firebase_token(token)
    except ValueError as exc:
        logger.warning("Firebase token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # --- User resolution ------------------------------------------------------
    try:
        db = get_database()
    except RuntimeError:
        # MongoDB unavailable — return a minimal user from verified claims
        logger.warning("MongoDB unavailable; returning minimal user from Firebase claims.")
        return {
            "_id": verified_claims["uid"],
            "name": verified_claims.get("name", verified_claims.get("email", "").split("@")[0]),
            "email": verified_claims.get("email", ""),
            "firebase_uid": verified_claims["uid"],
            "created_at": datetime.now(timezone.utc),
        }

    try:
        return await _get_or_create_firebase_user(verified_claims, db)
    except Exception as exc:
        logger.error("Failed to resolve user from Firebase claims: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve user account.",
        )
