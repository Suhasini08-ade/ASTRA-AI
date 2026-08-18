"""
routes/auth.py
==============
Authentication endpoints: register, login, and get current user.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.database import get_database
from backend.models.user import UserCreate, UserLogin, UserResponse, TokenResponse, GoogleAuthRequest
from backend.utils.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.utils.response import success_response
import logging
from pymongo.errors import PyMongoError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/google")
async def google_auth(
    google_data: GoogleAuthRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Authenticate or register a user via Google OAuth."""
    email = str(google_data.email).lower()

    try:
        user = await db.users.find_one({"email": email})
    except PyMongoError as exc:
        logger.error("MongoDB query failed during Google auth: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed during Google authentication.",
        )

    now = datetime.now(timezone.utc)

    if not user:
        # Create new user record for first-time Google sign-in
        user_doc = {
            "name": google_data.name,
            "email": email,
            "provider": "google",
            "avatar_url": google_data.avatar_url,
            "firebase_uid": google_data.uid,
            "hashed_password": None,
            "created_at": now,
        }
        try:
            result = await db.users.insert_one(user_doc)
            user_id = str(result.inserted_id)

            # Create default profile and settings
            await db.profiles.insert_one({
                "user_id": user_id,
                "name": google_data.name,
                "email": email,
                "avatar_url": google_data.avatar_url,
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
        # Update user profile picture / provider if missing
        update_fields = {}
        if not user.get("provider"):
            update_fields["provider"] = "google"
        if google_data.avatar_url and not user.get("avatar_url"):
            update_fields["avatar_url"] = google_data.avatar_url
        if update_fields:
            try:
                await db.users.update_one({"_id": user["_id"]}, {"$set": update_fields})
            except Exception as e:
                logger.warning("Failed to update user google details: %s", e)

    # Generate backend JWT
    token = create_access_token(user_id, email)

    created_at = user.get("created_at") if user else now
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)

    user_response = UserResponse(
        id=user_id,
        name=google_data.name if not user else user.get("name", google_data.name),
        email=email,
        created_at=created_at or now,
    )

    return success_response(
        data=TokenResponse(access_token=token, user=user_response).model_dump(),
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

    # Generate JWT
    token = create_access_token(user_id, email)

    user_response = UserResponse(
        id=user_id,
        name=user_data.name,
        email=email,
        created_at=now,
    )
    return success_response(
        data=TokenResponse(access_token=token, user=user_response).model_dump(),
        message="Registration successful.",
    )


@router.post("/login")
async def login(
    credentials: UserLogin,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Authenticate a user and return a JWT token."""
    email = str(credentials.email).lower()

    try:
        user = await db.users.find_one({"email": email})
    except PyMongoError as exc:
        logger.error("MongoDB query failed during login: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed during authentication.",
        )

    if not user or not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    user_id = str(user["_id"])
    token = create_access_token(user_id, user["email"])

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
        data=TokenResponse(access_token=token, user=user_response).model_dump(),
        message="Login successful.",
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get the currently authenticated user's information."""
    user_response = UserResponse(
        id=current_user["_id"],
        name=current_user["name"],
        email=current_user["email"],
        created_at=current_user["created_at"],
    )
    return success_response(data=user_response.model_dump())
