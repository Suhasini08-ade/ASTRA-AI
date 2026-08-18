"""
routes/tasks.py
===============
CRUD endpoints for task management.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.database import get_database
from backend.models.task import TaskCreate, TaskUpdate, TaskResponse, TaskStatus
from backend.utils.auth import get_current_user, optional_get_current_user
from backend.utils.response import success_response

import logging
from pymongo.errors import PyMongoError
from bson.errors import BSONError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


def _doc_to_response(doc: dict) -> dict:
    """Convert a MongoDB document to a TaskResponse-compatible dict."""
    return TaskResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        title=doc["title"],
        description=doc.get("description", ""),
        due_date=doc.get("due_date"),
        priority=doc.get("priority", "medium"),
        status=doc.get("status", "todo"),
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    ).model_dump()


@router.get("")
async def list_tasks(
    task_status: TaskStatus | None = Query(default=None, alias="status"),
    current_user: dict | None = Depends(optional_get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """List all tasks for the current user. Optionally filter by status."""
    if not current_user:
        return success_response(data=[])
    query: dict = {"user_id": current_user["_id"]}
    if task_status is not None:
        query["status"] = task_status.value

    try:
        cursor = db.tasks.find(query).sort("created_at", -1)
        tasks = await cursor.to_list(length=200)
        return success_response(data=[_doc_to_response(t) for t in tasks])
    except PyMongoError as exc:
        logger.error("Failed to list tasks: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve tasks from database.",
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Create a new task."""
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": current_user["_id"],
        "title": task_data.title,
        "description": task_data.description,
        "due_date": task_data.due_date,
        "priority": task_data.priority.value,
        "status": task_data.status.value,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.tasks.insert_one(doc)
        doc["_id"] = result.inserted_id
        return success_response(data=_doc_to_response(doc), message="Task created.")
    except PyMongoError as exc:
        logger.error("Failed to create task: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to insert task into database.",
        )


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Get a single task by ID."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task ID format.",
        )

    try:
        task = await db.tasks.find_one({
            "_id": ObjectId(task_id),
            "user_id": current_user["_id"],
        })
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to fetch task %s: %s", task_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while fetching task.",
        )

    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return success_response(data=_doc_to_response(task))


@router.put("/{task_id}")
async def update_task(
    task_id: str,
    task_data: TaskUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Update an existing task."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task ID format.",
        )

    update_fields = {}
    for field, value in task_data.model_dump(exclude_none=True).items():
        update_fields[field] = value.value if hasattr(value, "value") else value

    if not update_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update.",
        )

    update_fields["updated_at"] = datetime.now(timezone.utc)
    try:
        result = await db.tasks.find_one_and_update(
            {"_id": ObjectId(task_id), "user_id": current_user["_id"]},
            {"$set": update_fields},
            return_document=True,
        )
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to update task %s: %s", task_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating task.",
        )

    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return success_response(data=_doc_to_response(result), message="Task updated.")


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete a task by ID."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task ID format.",
        )

    try:
        result = await db.tasks.delete_one({
            "_id": ObjectId(task_id),
            "user_id": current_user["_id"],
        })
    except (PyMongoError, BSONError) as exc:
        logger.error("Failed to delete task %s: %s", task_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting task.",
        )

    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return success_response(message="Task deleted.")
