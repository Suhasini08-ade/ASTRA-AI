"""Authenticated persistence endpoints for Focus Mode sessions."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from backend.database import get_database
from backend.models.focus_session import FocusSessionCreate, FocusSessionResponse
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

router = APIRouter(prefix="/api/focus-sessions", tags=["Focus Sessions"])


def _response(doc: dict) -> dict:
    return FocusSessionResponse(
        id=str(doc["_id"]), user_id=doc["user_id"], task_id=doc["task_id"],
        task_title=doc["task_title"], duration_seconds=doc["duration_seconds"],
        status=doc["status"], timestamp=doc["timestamp"],
    ).model_dump()


@router.get("")
async def list_focus_sessions(
    limit: int = Query(default=8, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Return only the current user's most recent sessions."""
    try:
        sessions = await db.focus_sessions.find({"user_id": current_user["_id"]}).sort(
            "timestamp", -1
        ).to_list(length=limit)
        return success_response(data=[_response(session) for session in sessions])
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail="Failed to retrieve focus sessions.") from exc


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_focus_session(
    session: FocusSessionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Store a completed or stopped session against its authenticated owner."""
    if not ObjectId.is_valid(session.task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID format.")

    try:
        task = await db.tasks.find_one({
            "_id": ObjectId(session.task_id), "user_id": current_user["_id"],
        })
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail="Failed to validate focus task.") from exc

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    # The title is copied from the verified, user-owned task rather than supplied
    # by the client, preventing a session from being linked to another user's task.
    doc = {
        "user_id": current_user["_id"], "task_id": session.task_id,
        "task_title": task["title"], "duration_seconds": session.duration_seconds,
        "status": session.status.value, "timestamp": datetime.now(timezone.utc),
    }
    try:
        result = await db.focus_sessions.insert_one(doc)
        doc["_id"] = result.inserted_id
        return success_response(data=_response(doc), message="Focus session saved.")
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail="Failed to save focus session.") from exc
