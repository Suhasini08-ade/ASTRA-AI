"""
routes/calendar.py
==================
CRUD endpoints for calendar events.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from backend.database import get_database
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

import logging
from pymongo.errors import PyMongoError
from bson.errors import BSONError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


# --- Schemas (inline since they're only used here) ---

class EventCreate(BaseModel):
    """Schema for creating a calendar event."""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="")
    start_time: datetime
    end_time: datetime
    color: str = Field(default="#4f46e5", max_length=7)


class EventUpdate(BaseModel):
    """Schema for updating a calendar event. All fields optional."""
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    color: str | None = Field(default=None, max_length=7)


def _doc_to_response(doc: dict) -> dict:
    """Convert a MongoDB document to a response dict."""
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "title": doc["title"],
        "description": doc.get("description", ""),
        "start_time": doc["start_time"].isoformat() if doc.get("start_time") else None,
        "end_time": doc["end_time"].isoformat() if doc.get("end_time") else None,
        "color": doc.get("color", "#4f46e5"),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
    }


@router.get("/events")
async def list_events(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List calendar events, optionally filtered by date range."""
    query: dict = {"user_id": current_user["_id"]}
    if start:
        query.setdefault("start_time", {})["$gte"] = start
    if end:
        query.setdefault("start_time", {})["$lte"] = end

    try:
        cursor = db.calendar_events.find(query).sort("start_time", 1)
        events = await cursor.to_list(length=500)
        return success_response(data=[_doc_to_response(e) for e in events])
    except PyMongoError as exc:
        logger.error("Failed to list calendar events: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve events from database.",
        )


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create a new calendar event."""
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": current_user["_id"],
        "title": event_data.title,
        "description": event_data.description,
        "start_time": event_data.start_time,
        "end_time": event_data.end_time,
        "color": event_data.color,
        "created_at": now,
    }
    try:
        result = await db.calendar_events.insert_one(doc)
        doc["_id"] = result.inserted_id
        return success_response(data=_doc_to_response(doc), message="Event created.")
    except PyMongoError as exc:
        logger.error("Failed to create event: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to insert event into database.",
        )


@router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    event_data: EventUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update an existing calendar event."""
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format.",
        )

    update_fields = event_data.model_dump(exclude_none=True)
    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    try:
        result = await db.calendar_events.find_one_and_update(
            {"_id": ObjectId(event_id), "user_id": current_user["_id"]},
            {"$set": update_fields},
            return_document=True,
        )
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to update event %s: %s", event_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating event.",
        )

    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return success_response(data=_doc_to_response(result), message="Event updated.")


@router.delete("/events/{event_id}")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete a calendar event by ID."""
    if not ObjectId.is_valid(event_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format.",
        )

    try:
        result = await db.calendar_events.delete_one({
            "_id": ObjectId(event_id),
            "user_id": current_user["_id"],
        })
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to delete event %s: %s", event_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting event.",
        )

    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return success_response(message="Event deleted.")
