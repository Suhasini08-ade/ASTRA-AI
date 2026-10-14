"""
routes/auth.py
==============
Authentication endpoints: register, login, Google auth, and current user.

After the Firebase security refactor, the ``/google`` endpoint now verifies
the Firebase ID token from the Authorization header instead of trusting
frontend-supplied claims.  Email/password endpoints are retained for backward
compatibility and continue to create local user records.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.database import get_database
from backend.models.user import UserCreate, UserLogin, UserResponse, TokenResponse, GoogleAuthRequest
from backend.utils.auth import (
    get_current_user,
    hash_password,
    verify_password,
)
from backend.utils.firebase_init import verify_firebase_token
from backend.utils.response import success_response
import logging
from pymongo.errors import PyMongoError
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

_bearer_scheme = HTTPBearer(auto_error=False)


@router.post("/google")
async def google_auth(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Authenticate or register a user via Google OAuth.

    The frontend must send the Firebase ID token in the Authorization header.
    This endpoint verifies the token server-side and never trusts client-sent
    email/uid/name directly.
    """
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token required. Sign in with Google first.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify the Firebase ID token
    try:
        verified = verify_firebase_token(creds.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid = verified["uid"]
    email = verified.get("email", "").lower()
    name = verified.get("name", email.split("@")[0] if email else "Google User")
    avatar_url = verified.get("picture", None)

    now = datetime.now(timezone.utc)

    try:
        # Look up by firebase_uid first, then by email
        user = await db.users.find_one({"firebase_uid": firebase_uid})
        if not user and email:
            user = await db.users.find_one({"email": email})
    except PyMongoError as exc:
        logger.error("MongoDB query failed during Google auth: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed during Google authentication.",
        )

    if not user:
        # Create new user record for first-time Google sign-in
        user_doc = {
            "name": name,
            "email": email,
            "provider": "google",
            "avatar_url": avatar_url,
            "firebase_uid": firebase_uid,
            "hashed_password": None,
            "created_at": now,
        }
        try:
            result = await db.users.insert_one(user_doc)
            user_id = str(result.inserted_id)

            # Create default profile and settings
            await db.profiles.insert_one({
                "user_id": user_id,
                "name": name,
                "email": email,
                "avatar_url": avatar_url,
                "bio": "Google Authenticated User",
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
        except PyMongoError as exc:
            logger.error("MongoDB insert failed during Google registration: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database failed to create user account.",
            )
    else:
        user_id = str(user["_id"])
        # Backfill firebase_uid and update profile if needed
        update_fields = {}
        if not user.get("firebase_uid"):
            update_fields["firebase_uid"] = firebase_uid
        if not user.get("provider"):
            update_fields["provider"] = "google"
        if avatar_url and not user.get("avatar_url"):
            update_fields["avatar_url"] = avatar_url
        if update_fields:
            try:
                await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
            except Exception as e:
                logger.warning("Failed to update user google details: %s", e)

    created_at = user.get("created_at") if user else now
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)

    user_response = UserResponse(
        id=user_id,
        name=name if not user else user.get("name", name),
        email=email,
        created_at=created_at or now,
    )

    return success_response(
        data={"user": user_response.model_dump()},
        message="Google authentication successful.",
    )


@router.post("/register", response_model=None, status_code=status.HTTP_201_CREATED)

async def register(
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Register a new user account."""
    email = str(user_data.email).lower()

    try:
        existing = await db.users.find_one({"email": email})
    except PyMongoError as exc:
        logger.error("MongoDB query failed during registration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed during user check.",
        )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    now = datetime.now(timezone.utc)
    user_doc = {
        "name": user_data.name,
        "email": email,
        "hashed_password": hash_password(user_data.password),
        "created_at": now,
    }

    try:
        result = await db.users.insert_one(user_doc)
        user_id = str(result.inserted_id)

        # Create default profile and settings for new user
        await db.profiles.insert_one({
            "user_id": user_id,
            "name": user_data.name,
            "email": email,
            "avatar_url": None,
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
    except PyMongoError as exc:
        logger.error("MongoDB insert failed during registration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database failed to create user account.",
        )

    user_response = UserResponse(
        id=user_id,
        name=user_data.name,
        email=email,
        created_at=now,
    )
    return success_response(
        data={"user": user_response.model_dump()},
        message="Registration successful.",
    )


@router.post("/login")
async def login(
    credentials: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Authenticate a user and return user data."""
    email = str(credentials.email).lower()

    try:
        user = await db.users.find_one({"email": email})
    except PyMongoError as exc:
        logger.error("MongoDB query failed during login: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed during authentication.",
        )

    if not user or not user.get("hashed_password") or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_id = str(user["_id"])

    created_at = user.get("created_at")
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)

    user_response = UserResponse(
        id=user_id,
        name=user["name"],
        email=user["email"],
        created_at=created_at or datetime.now(timezone.utc),
    )
    return success_response(
        data={"user": user_response.model_dump()},
        message="Login successful.",
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's information."""
    user_response = UserResponse(
        id=current_user["_id"],
        name=current_user.get("name", "User"),
        email=current_user.get("email", ""),
        created_at=current_user.get("created_at", datetime.now(timezone.utc)),
    )
    return success_response(data=user_response.model_dump())
