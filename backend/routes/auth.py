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
    _get_or_create_firebase_user,
    create_access_token,
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

    The frontend sends the verified Firebase ID token in the Authorization header.
    Resolves or creates the user record atomically using the verified claims.
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

    user = await _get_or_create_firebase_user(verified, db)
    created_at = user.get("created_at") or datetime.now(timezone.utc)
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)

    user_response = UserResponse(
        id=user["_id"],
        name=user.get("name", "User"),
        email=user.get("email", ""),
        created_at=created_at,
    )

    return success_response(
        data={"user": user_response.model_dump()},
        message="Google authentication successful.",
    )


@router.post("/register", response_model=None, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Register or synchronize a user account."""
    email = str(user_data.email).lower()

    # If client is already authenticated in Firebase, synchronize the account safely
    if creds is not None:
        try:
            verified = verify_firebase_token(creds.credentials)
            if not verified.get("name") and user_data.name:
                verified["name"] = user_data.name
            user = await _get_or_create_firebase_user(verified, db)
            created_at = user.get("created_at") or datetime.now(timezone.utc)
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            user_response = UserResponse(
                id=user["_id"],
                name=user.get("name", user_data.name),
                email=user.get("email", email),
                created_at=created_at,
            )
            return success_response(
                data={"user": user_response.model_dump()},
                message="Registration successful.",
            )
        except ValueError as exc:
            logger.warning("Firebase token verification during register fallback: %s", exc)

    # Direct registration flow
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

        # Create default profile and settings for new user idempotently
        await db.profiles.update_one(
            {"user_id": user_id},
            {"$setOnInsert": {
                "user_id": user_id,
                "name": user_data.name,
                "email": email,
                "avatar_url": None,
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
    access_token = create_access_token({"sub": user_id, "email": email})
    return success_response(
        data={
            "user": user_response.model_dump(),
            "access_token": access_token,
            "token": access_token,
            "token_type": "bearer",
        },
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
    access_token = create_access_token({"sub": user_id, "email": user["email"]})
    return success_response(
        data={
            "user": user_response.model_dump(),
            "access_token": access_token,
            "token": access_token,
            "token_type": "bearer",
        },
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
    resp = user_response.model_dump()
    resp["bio"] = current_user.get("bio", "ASTRA AI Productivity Power User")
    resp["avatar"] = current_user.get("avatar", "")
    return success_response(data=resp)


@router.put("/profile")
@router.put("/me")
async def update_profile(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update profile information for the authenticated user."""
    user_id = current_user["_id"]
    update_doc = {}
    if "name" in body and body["name"]:
        update_doc["name"] = body["name"].strip()
    if "bio" in body and body["bio"] is not None:
        update_doc["bio"] = body["bio"].strip()
    if "avatar" in body and body["avatar"]:
        update_doc["avatar"] = body["avatar"].strip()

    if update_doc:
        query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}]} if ObjectId.is_valid(user_id) else {"_id": user_id}
        await db.users.update_one(query, {"$set": update_doc})

    return success_response(
        data={"id": user_id, **update_doc},
        message="Profile updated successfully.",
    )


@router.get("/settings")
async def get_settings_prefs(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get persisted user settings and preferences."""
    user_id = current_user["_id"]
    query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}]} if ObjectId.is_valid(user_id) else {"_id": user_id}
    user = await db.users.find_one(query)
    settings = (user or {}).get("settings", {
        "notifications": {"tasks": True, "reminders": True, "aiAlerts": False},
        "aiProvider": "gemini",
        "voiceSpeed": "1.0",
        "theme": "dark",
    })
    return success_response(data=settings)


@router.put("/settings")
async def update_settings_prefs(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Persist user settings and preferences."""
    user_id = current_user["_id"]
    query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}]} if ObjectId.is_valid(user_id) else {"_id": user_id}
    await db.users.update_one(query, {"$set": {"settings": body}})
    return success_response(data=body, message="Settings updated successfully.")
