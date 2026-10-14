"""
routes/notes.py
===============
CRUD endpoints for notes management.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.database import get_database
from backend.models.note import NoteCreate, NoteUpdate, NoteResponse
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

import logging
from pymongo.errors import PyMongoError
from bson.errors import BSONError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notes", tags=["Notes"])


def _doc_to_response(doc: dict) -> dict:
    """Convert a MongoDB document to a NoteResponse-compatible dict."""
    return NoteResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        title=doc["title"],
        content=doc["content"],
        tags=doc.get("tags", []),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    ).model_dump()


@router.get("")
async def list_notes(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List all notes for the current user."""
    try:
        cursor = db.notes.find({"user_id": current_user["_id"]}).sort("created_at", -1)
        notes = await cursor.to_list(length=200)
        return success_response(data=[_doc_to_response(n) for n in notes])
    except PyMongoError as exc:
        logger.error("Failed to list notes: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve notes from database.",
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create a new note."""

    logger.info("[NOTE API] 1. Received POST /api/notes request from user_id='%s'", current_user["_id"])
    logger.info("[NOTE API] 2. Payload: %s", note_data.model_dump())
    logger.info("[NOTE API] 3. Database: '%s' | Collection: '%s'", db.name, db.notes.name)

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": current_user["_id"],
        "title": note_data.title,
        "content": note_data.content,
        "tags": note_data.tags,
        "created_at": now,
        "updated_at": now,
    }
    try:
        logger.info("[NOTE API] 4. Executing insert_one()...")
        result = await db.notes.insert_one(doc)
        inserted_id = result.inserted_id
        logger.info("[NOTE API] 5. InsertOneResult.inserted_id: %s", inserted_id)

        # 6. Post-insert verification query
        verification_doc = await db.notes.find_one({"_id": inserted_id})
        logger.info("[NOTE API] 7. Immediate query verification result: %s", verification_doc)

        doc["_id"] = inserted_id
        return success_response(
            data=_doc_to_response(doc),
            message="Note created.",
        )
    except PyMongoError as exc:
        logger.error("[NOTE API] Failed to create note: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to insert note into database.",
        )


@router.get("/{note_id}")
async def get_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get a single note by ID."""
    if not ObjectId.is_valid(note_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid note ID format.",
        )

    try:
        note = await db.notes.find_one({
            "_id": ObjectId(note_id),
            "user_id": current_user["_id"],
        })
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to fetch note %s: %s", note_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while fetching note.",
        )

    if not note:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")
    return success_response(data=_doc_to_response(note))


@router.put("/{note_id}")
async def update_note(
    note_id: str,
    note_data: NoteUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update an existing note."""
    if not ObjectId.is_valid(note_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid note ID format.",
        )

    update_fields = note_data.model_dump(exclude_none=True)
    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    update_fields["updated_at"] = datetime.now(timezone.utc)
    try:
        result = await db.notes.find_one_and_update(
            {"_id": ObjectId(note_id), "user_id": current_user["_id"]},
            {"$set": update_fields},
            return_document=True,
        )
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to update note %s: %s", note_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating note.",
        )

    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")
    return success_response(data=_doc_to_response(result), message="Note updated.")


@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete a note by ID."""
    if not ObjectId.is_valid(note_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid note ID format.",
        )

    try:
        result = await db.notes.delete_one({
            "_id": ObjectId(note_id),
            "user_id": current_user["_id"],
        })
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to delete note %s: %s", note_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting note.",
        )

    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found.")
    return success_response(message="Note deleted.")
