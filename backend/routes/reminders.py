"""
routes/reminders.py
===================
CRUD endpoints for reminders management.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.database import get_database
from backend.models.reminder import ReminderCreate, ReminderUpdate, ReminderResponse
from backend.utils.auth import get_current_user, optional_get_current_user
from backend.utils.response import success_response

import logging
from pymongo.errors import PyMongoError
from bson.errors import BSONError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reminders", tags=["Reminders"])


def _doc_to_response(doc: dict) -> dict:
    """Convert a MongoDB document to a ReminderResponse-compatible dict."""
    return ReminderResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        message=doc["message"],
        due_time=doc["due_time"],
        repeat=doc.get("repeat"),
        is_active=doc.get("is_active", True),
        created_at=doc["created_at"],
    ).model_dump()


@router.get("")
async def list_reminders(
    current_user: dict | None = Depends(optional_get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List all reminders for the current user."""
    if not current_user:
        return success_response(data=[])
    try:
        cursor = db.reminders.find({"user_id": current_user["_id"]}).sort("due_time", 1)
        reminders = await cursor.to_list(length=200)
        return success_response(data=[_doc_to_response(r) for r in reminders])
    except PyMongoError as exc:
        logger.error("Failed to list reminders: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reminders from database.",
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_reminder(
    reminder_data: ReminderCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create a new reminder."""
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": current_user["_id"],
        "message": reminder_data.message,
        "due_time": reminder_data.due_time,
        "repeat": reminder_data.repeat,
        "is_active": True,
        "created_at": now,
    }
    try:
        result = await db.reminders.insert_one(doc)
        doc["_id"] = result.inserted_id
        return success_response(data=_doc_to_response(doc), message="Reminder created.")
    except PyMongoError as exc:
        logger.error("Failed to create reminder: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to insert reminder into database.",
        )


@router.put("/{reminder_id}")
async def update_reminder(
    reminder_id: str,
    reminder_data: ReminderUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update an existing reminder."""
    if not ObjectId.is_valid(reminder_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reminder ID format.",
        )

    update_fields = reminder_data.model_dump(exclude_none=True)
    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    try:
        result = await db.reminders.find_one_and_update(
            {"_id": ObjectId(reminder_id), "user_id": current_user["_id"]},
            {"$set": update_fields},
            return_document=True,
        )
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to update reminder %s: %s", reminder_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating reminder.",
        )

    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return success_response(data=_doc_to_response(result), message="Reminder updated.")


@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete a reminder by ID."""
    if not ObjectId.is_valid(reminder_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reminder ID format.",
        )

    try:
        result = await db.reminders.delete_one({
            "_id": ObjectId(reminder_id),
            "user_id": current_user["_id"],
        })
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to delete reminder %s: %s", reminder_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting reminder.",
        )

    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")
    return success_response(message="Reminder deleted.")
