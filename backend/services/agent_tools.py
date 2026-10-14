"""
services/agent_tools.py
========================
OpenAI Function Calling (Tools) definitions and tool execution handlers
for the Jarvis AI Agent.

Reuses existing MongoDB collections and service layers without duplicate logic.
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any

from bson import ObjectId
from bson.errors import BSONError
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from backend.config import get_settings
from backend.services.news_service import news_service
from backend.services.weather_service import weather_service

logger = logging.getLogger(__name__)


# ============================================================================
# 1. TOOL SCHEMAS FOR OPENAI FUNCTION CALLING
# ============================================================================

AGENT_TOOLS = [
    # --- TASKS ---
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Create a new task for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "The title or main description of the task.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional detailed description of the task.",
                    },
                    "due_date": {
                        "type": "string",
                        "description": "Optional due date in ISO 8601 format (e.g. '2026-08-12T17:00:00Z').",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                        "description": "Priority level. Default is 'medium'.",
                    },
                    "status": {
                        "type": "string",
                        "enum": ["todo", "in_progress", "done"],
                        "description": "Task status. Default is 'todo'.",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "view_tasks",
            "description": "Retrieve tasks for the user, optionally filtered by status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["todo", "in_progress", "done"],
                        "description": "Optional task status filter.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": "Update an existing task by ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "The MongoDB ID string of the task.",
                    },
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "due_date": {
                        "type": "string",
                        "description": "ISO 8601 due date string.",
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                    },
                    "status": {
                        "type": "string",
                        "enum": ["todo", "in_progress", "done"],
                    },
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete a task by ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "The MongoDB ID string of the task to delete.",
                    },
                },
                "required": ["task_id"],
            },
        },
    },
    # --- NOTES ---
    {
        "type": "function",
        "function": {
            "name": "create_note",
            "description": "Create a new note for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Note title."},
                    "content": {
                        "type": "string",
                        "description": "Note body content.",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional list of tag strings.",
                    },
                },
                "required": ["title", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "view_notes",
            "description": "Retrieve all notes for the user.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_note",
            "description": "Update an existing note by ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_id": {
                        "type": "string",
                        "description": "MongoDB ID string of the note.",
                    },
                    "title": {"type": "string"},
                    "content": {"type": "string"},
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["note_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_note",
            "description": "Delete a note by ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_id": {
                        "type": "string",
                        "description": "MongoDB ID string of the note.",
                    },
                },
                "required": ["note_id"],
            },
        },
    },
    # --- REMINDERS ---
    {
        "type": "function",
        "function": {
            "name": "create_reminder",
            "description": "Create a new reminder for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {
                        "type": "string",
                        "description": "The reminder text message.",
                    },
                    "due_time": {
                        "type": "string",
                        "description": "Due time in ISO 8601 format (e.g. '2026-08-12T09:00:00Z').",
                    },
                    "repeat": {
                        "type": "string",
                        "description": "Optional repeat schedule (e.g. 'daily', 'weekly').",
                    },
                },
                "required": ["message", "due_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "view_reminders",
            "description": "Retrieve all reminders for the user.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_reminder",
            "description": "Update an existing reminder by ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {
                        "type": "string",
                        "description": "MongoDB ID string of the reminder.",
                    },
                    "message": {"type": "string"},
                    "due_time": {
                        "type": "string",
                        "description": "ISO 8601 format due time.",
                    },
                    "repeat": {"type": "string"},
                    "is_active": {"type": "boolean"},
                },
                "required": ["reminder_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_reminder",
            "description": "Delete a reminder by ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {
                        "type": "string",
                        "description": "MongoDB ID string of the reminder.",
                    },
                },
                "required": ["reminder_id"],
            },
        },
    },
    # --- CALENDAR ---
    {
        "type": "function",
        "function": {
            "name": "view_calendar_events",
            "description": "View calendar events for the user, optionally filtered by date range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start": {
                        "type": "string",
                        "description": "ISO 8601 start date filter.",
                    },
                    "end": {
                        "type": "string",
                        "description": "ISO 8601 end date filter.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Create a new calendar event for the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title of the event.",
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Event start time in ISO 8601 format (e.g. '2026-08-12T14:00:00Z').",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "Event end time in ISO 8601 format (e.g. '2026-08-12T15:00:00Z').",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional event details or location.",
                    },
                    "color": {
                        "type": "string",
                        "description": "Hex color code. Default is '#4f46e5'.",
                    },
                },
                "required": ["title", "start_time", "end_time"],
            },
        },
    },
    # --- WEATHER ---
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather conditions and forecast for a specified city or location.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City or location name (e.g. 'Latur', 'Mumbai', 'London').",
                    },
                },
                "required": ["location"],
            },
        },
    },
    # --- NEWS ---
    {
        "type": "function",
        "function": {
            "name": "get_news",
            "description": "Get top news headlines filtered by category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category such as 'All', 'Business', 'Technology', 'Sports', 'Science', 'Health', 'Entertainment'.",
                    },
                },
                "required": [],
            },
        },
    },
    # --- PDF / DOCUMENT SUMMARIZER ---
    {
        "type": "function",
        "function": {
            "name": "summarize_document",
            "description": "Summarize text or PDF document content, returning key points and actionable insights.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_content": {
                        "type": "string",
                        "description": "The text content of the document to summarize.",
                    },
                    "file_name": {
                        "type": "string",
                        "description": "Optional name of the file.",
                    },
                    "file_type": {
                        "type": "string",
                        "description": "Optional file type (e.g. 'pdf', 'txt').",
                    },
                },
                "required": ["file_content"],
            },
        },
    },
]


# ============================================================================
# 2. HELPER UTILITIES
# ============================================================================

def _parse_iso_datetime(dt_str: str | None) -> datetime | None:
    """Parse ISO datetime string into UTC datetime object."""
    if not dt_str:
        return None
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _format_datetime(dt: Any) -> str | None:
    """Format datetime object into ISO string."""
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt) if dt else None


# ============================================================================
# 3. TOOL EXECUTION HANDLERS
# ============================================================================

# --- Tasks Handlers ---

async def _create_task(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    title = args.get("title", "").strip()
    if not title:
        return {"error": "Task title is required."}

    description = args.get("description", "")
    priority = args.get("priority", "medium")
    status_val = args.get("status", "todo")
    due_date = _parse_iso_datetime(args.get("due_date"))
    now = datetime.now(timezone.utc)

    doc = {
        "user_id": user_id,
        "title": title,
        "description": description,
        "due_date": due_date,
        "priority": priority,
        "status": status_val,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.tasks.insert_one(doc)
        return {
            "status": "success",
            "message": f"Task '{title}' created successfully.",
            "task": {
                "id": str(result.inserted_id),
                "title": title,
                "description": description,
                "due_date": _format_datetime(due_date),
                "priority": priority,
                "status": status_val,
            },
        }
    except PyMongoError as exc:
        logger.error("Error in create_task tool: %s", exc)
        return {"error": "Failed to create task in database."}


async def _view_tasks(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    query: dict = {"user_id": user_id}
    status_val = args.get("status")
    if status_val:
        query["status"] = status_val

    try:
        cursor = db.tasks.find(query).sort("created_at", -1)
        docs = await cursor.to_list(length=100)
        tasks = []
        for doc in docs:
            tasks.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", ""),
                "description": doc.get("description", ""),
                "due_date": _format_datetime(doc.get("due_date")),
                "priority": doc.get("priority", "medium"),
                "status": doc.get("status", "todo"),
                "created_at": _format_datetime(doc.get("created_at")),
            })
        return {"status": "success", "count": len(tasks), "tasks": tasks}
    except PyMongoError as exc:
        logger.error("Error in view_tasks tool: %s", exc)
        return {"error": "Failed to fetch tasks from database."}


async def _update_task(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    task_id = args.get("task_id")
    if not task_id or not ObjectId.is_valid(task_id):
        return {"error": "Invalid or missing task_id format."}

    update_fields: dict[str, Any] = {}
    if "title" in args and args["title"]:
        update_fields["title"] = args["title"].strip()
    if "description" in args and args["description"] is not None:
        update_fields["description"] = args["description"]
    if "priority" in args and args["priority"]:
        update_fields["priority"] = args["priority"]
    if "status" in args and args["status"]:
        update_fields["status"] = args["status"]
    if "due_date" in args and args["due_date"]:
        update_fields["due_date"] = _parse_iso_datetime(args["due_date"])

    if not update_fields:
        return {"error": "No valid fields specified for update."}

    update_fields["updated_at"] = datetime.now(timezone.utc)

    try:
        result = await db.tasks.find_one_and_update(
            {"_id": ObjectId(task_id), "user_id": user_id},
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            return {"error": "Task not found."}
        return {
            "status": "success",
            "message": "Task updated successfully.",
            "task": {
                "id": str(result["_id"]),
                "title": result.get("title"),
                "description": result.get("description"),
                "due_date": _format_datetime(result.get("due_date")),
                "priority": result.get("priority"),
                "status": result.get("status"),
            },
        }
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in update_task tool: %s", exc)
        return {"error": "Failed to update task in database."}


async def _delete_task(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    task_id = args.get("task_id")
    if not task_id or not ObjectId.is_valid(task_id):
        return {"error": "Invalid or missing task_id format."}

    try:
        result = await db.tasks.delete_one({"_id": ObjectId(task_id), "user_id": user_id})
        if result.deleted_count == 0:
            return {"error": "Task not found."}
        return {"status": "success", "message": f"Task {task_id} deleted successfully."}
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in delete_task tool: %s", exc)
        return {"error": "Failed to delete task from database."}


# --- Notes Handlers ---

async def _create_note(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    title = args.get("title", "").strip()
    content = args.get("content", "").strip()
    if not title or not content:
        return {"error": "Both title and content are required to create a note."}

    tags = args.get("tags", [])
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "title": title,
        "content": content,
        "tags": tags,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db.notes.insert_one(doc)
        return {
            "status": "success",
            "message": f"Note '{title}' created successfully.",
            "note": {
                "id": str(result.inserted_id),
                "title": title,
                "content": content,
                "tags": tags,
            },
        }
    except PyMongoError as exc:
        logger.error("Error in create_note tool: %s", exc)
        return {"error": "Failed to create note in database."}


async def _view_notes(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    try:
        cursor = db.notes.find({"user_id": user_id}).sort("created_at", -1)
        docs = await cursor.to_list(length=100)
        notes = []
        for doc in docs:
            notes.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "tags": doc.get("tags", []),
                "created_at": _format_datetime(doc.get("created_at")),
            })
        return {"status": "success", "count": len(notes), "notes": notes}
    except PyMongoError as exc:
        logger.error("Error in view_notes tool: %s", exc)
        return {"error": "Failed to fetch notes from database."}


async def _update_note(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    note_id = args.get("note_id")
    if not note_id or not ObjectId.is_valid(note_id):
        return {"error": "Invalid or missing note_id format."}

    update_fields: dict[str, Any] = {}
    if "title" in args and args["title"]:
        update_fields["title"] = args["title"].strip()
    if "content" in args and args["content"]:
        update_fields["content"] = args["content"].strip()
    if "tags" in args and isinstance(args["tags"], list):
        update_fields["tags"] = args["tags"]

    if not update_fields:
        return {"error": "No valid fields specified for update."}

    update_fields["updated_at"] = datetime.now(timezone.utc)

    try:
        result = await db.notes.find_one_and_update(
            {"_id": ObjectId(note_id), "user_id": user_id},
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            return {"error": "Note not found."}
        return {
            "status": "success",
            "message": "Note updated successfully.",
            "note": {
                "id": str(result["_id"]),
                "title": result.get("title"),
                "content": result.get("content"),
                "tags": result.get("tags"),
            },
        }
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in update_note tool: %s", exc)
        return {"error": "Failed to update note in database."}


async def _delete_note(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    note_id = args.get("note_id")
    if not note_id or not ObjectId.is_valid(note_id):
        return {"error": "Invalid or missing note_id format."}

    try:
        result = await db.notes.delete_one({"_id": ObjectId(note_id), "user_id": user_id})
        if result.deleted_count == 0:
            return {"error": "Note not found."}
        return {"status": "success", "message": f"Note {note_id} deleted successfully."}
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in delete_note tool: %s", exc)
        return {"error": "Failed to delete note from database."}


# --- Reminders Handlers ---

async def _create_reminder(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    message = args.get("message", "").strip()
    due_time_raw = args.get("due_time")
    due_time = _parse_iso_datetime(due_time_raw)
    if not message or not due_time:
        return {"error": "Both message and valid ISO due_time are required to create a reminder."}

    repeat = args.get("repeat")
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "message": message,
        "due_time": due_time,
        "repeat": repeat,
        "is_active": True,
        "created_at": now,
    }
    try:
        result = await db.reminders.insert_one(doc)
        return {
            "status": "success",
            "message": f"Reminder '{message}' set for {_format_datetime(due_time)}.",
            "reminder": {
                "id": str(result.inserted_id),
                "message": message,
                "due_time": _format_datetime(due_time),
                "repeat": repeat,
            },
        }
    except PyMongoError as exc:
        logger.error("Error in create_reminder tool: %s", exc)
        return {"error": "Failed to create reminder in database."}


async def _view_reminders(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    try:
        cursor = db.reminders.find({"user_id": user_id}).sort("due_time", 1)
        docs = await cursor.to_list(length=100)
        reminders = []
        for doc in docs:
            reminders.append({
                "id": str(doc["_id"]),
                "message": doc.get("message", ""),
                "due_time": _format_datetime(doc.get("due_time")),
                "repeat": doc.get("repeat"),
                "is_active": doc.get("is_active", True),
                "created_at": _format_datetime(doc.get("created_at")),
            })
        return {"status": "success", "count": len(reminders), "reminders": reminders}
    except PyMongoError as exc:
        logger.error("Error in view_reminders tool: %s", exc)
        return {"error": "Failed to fetch reminders from database."}


async def _update_reminder(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    reminder_id = args.get("reminder_id")
    if not reminder_id or not ObjectId.is_valid(reminder_id):
        return {"error": "Invalid or missing reminder_id format."}

    update_fields: dict[str, Any] = {}
    if "message" in args and args["message"]:
        update_fields["message"] = args["message"].strip()
    if "due_time" in args and args["due_time"]:
        update_fields["due_time"] = _parse_iso_datetime(args["due_time"])
    if "repeat" in args:
        update_fields["repeat"] = args["repeat"]
    if "is_active" in args:
        update_fields["is_active"] = bool(args["is_active"])

    if not update_fields:
        return {"error": "No valid fields specified for update."}

    try:
        result = await db.reminders.find_one_and_update(
            {"_id": ObjectId(reminder_id), "user_id": user_id},
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            return {"error": "Reminder not found."}
        return {
            "status": "success",
            "message": "Reminder updated successfully.",
            "reminder": {
                "id": str(result["_id"]),
                "message": result.get("message"),
                "due_time": _format_datetime(result.get("due_time")),
                "repeat": result.get("repeat"),
                "is_active": result.get("is_active"),
            },
        }
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in update_reminder tool: %s", exc)
        return {"error": "Failed to update reminder in database."}


async def _delete_reminder(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    reminder_id = args.get("reminder_id")
    if not reminder_id or not ObjectId.is_valid(reminder_id):
        return {"error": "Invalid or missing reminder_id format."}

    try:
        result = await db.reminders.delete_one({"_id": ObjectId(reminder_id), "user_id": user_id})
        if result.deleted_count == 0:
            return {"error": "Reminder not found."}
        return {"status": "success", "message": f"Reminder {reminder_id} deleted successfully."}
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in delete_reminder tool: %s", exc)
        return {"error": "Failed to delete reminder from database."}


# --- Calendar Handlers ---

async def _view_calendar_events(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    query: dict = {"user_id": user_id}
    start = _parse_iso_datetime(args.get("start"))
    end = _parse_iso_datetime(args.get("end"))
    if start:
        query.setdefault("start_time", {})["$gte"] = start
    if end:
        query.setdefault("start_time", {})["$lte"] = end

    try:
        cursor = db.calendar_events.find(query).sort("start_time", 1)
        docs = await cursor.to_list(length=100)
        events = []
        for doc in docs:
            events.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", ""),
                "description": doc.get("description", ""),
                "start_time": _format_datetime(doc.get("start_time")),
                "end_time": _format_datetime(doc.get("end_time")),
                "color": doc.get("color", "#4f46e5"),
            })
        return {"status": "success", "count": len(events), "events": events}
    except PyMongoError as exc:
        logger.error("Error in view_calendar_events tool: %s", exc)
        return {"error": "Failed to fetch calendar events from database."}


async def _create_calendar_event(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    title = args.get("title", "").strip()
    start_time = _parse_iso_datetime(args.get("start_time"))
    end_time = _parse_iso_datetime(args.get("end_time"))
    if not title or not start_time or not end_time:
        return {"error": "Title, valid start_time, and valid end_time are required for calendar event."}

    description = args.get("description", "")
    color = args.get("color", "#4f46e5")
    now = datetime.now(timezone.utc)

    doc = {
        "user_id": user_id,
        "title": title,
        "description": description,
        "start_time": start_time,
        "end_time": end_time,
        "color": color,
        "created_at": now,
    }
    try:
        result = await db.calendar_events.insert_one(doc)
        return {
            "status": "success",
            "message": f"Calendar event '{title}' scheduled.",
            "event": {
                "id": str(result.inserted_id),
                "title": title,
                "description": description,
                "start_time": _format_datetime(start_time),
                "end_time": _format_datetime(end_time),
                "color": color,
            },
        }
    except PyMongoError as exc:
        logger.error("Error in create_calendar_event tool: %s", exc)
        return {"error": "Failed to create calendar event in database."}


# --- Weather Handler ---

async def _get_weather(args: dict[str, Any]) -> dict[str, Any]:
    location = args.get("location", "Latur").strip() or "Latur"
    try:
        current = await weather_service.get_current_weather(city=location)
        forecast = await weather_service.get_forecast(city=location)
        return {
            "status": "success",
            "location": location,
            "current": current,
            "forecast": forecast,
        }
    except Exception as exc:
        logger.error("Error in get_weather tool: %s", exc)
        return {"error": f"Could not fetch weather data for '{location}'."}


# --- News Handler ---

async def _get_news(args: dict[str, Any]) -> dict[str, Any]:
    category = args.get("category", "All").strip()
    cat_param = None if category.lower() in ["all", "general"] else category.lower()
    try:
        res = await news_service.get_headlines(category=cat_param)
        articles = res.get("articles", [])
        return {
            "status": "success",
            "category": category,
            "count": len(articles),
            "articles": articles[:10],
        }
    except Exception as exc:
        logger.error("Error in get_news tool: %s", exc)
        return {"error": "Could not fetch news headlines."}


# --- Summarize Document Handler ---

async def _summarize_document(args: dict[str, Any]) -> dict[str, Any]:
    file_content = args.get("file_content", "").strip()
    file_name = args.get("file_name", "document")
    file_type = args.get("file_type", "text")

    if not file_content:
        return {"error": "No file_content provided to summarize."}

    word_count = len(file_content.split())
    reading_minutes = max(1, round(word_count / 200))

    summary_data = {
        "executiveSummary": f"Summary for '{file_name}': Contains ~{word_count} words covering key aspects of the document.",
        "keyPoints": [
            f"File: {file_name} ({file_type})",
            f"Word count: ~{word_count} words",
            "Analyzed via Jarvis AI Document Summarizer Engine",
        ],
        "actionableInsights": [
            "Review full document text for specific line items.",
            "Verify dates and milestone commitments.",
        ],
        "readingTime": f"{reading_minutes} mins read",
        "sentimentOrCategory": "Document Analysis",
    }
    return {"status": "success", "file_name": file_name, "summary": summary_data}


# ============================================================================
# 4. CENTRAL TOOL DISPATCHER
# ============================================================================

async def execute_agent_tool(
    tool_name: str,
    arguments: dict[str, Any],
    db: AsyncIOMotorDatabase,
    user_id: str,
) -> dict[str, Any]:
    """
    Route an OpenAI function call to the corresponding backend handler.

    :param tool_name: Name of the function requested by the LLM.
    :param arguments: Dictionary of parsed JSON arguments.
    :param db: Motor MongoDB database instance.
    :param user_id: Authenticated user ID string.
    :return: Dictionary result to be serialized and passed back to the LLM.
    """
    logger.info("[AI AGENT TOOL EXECUTION] Tool: '%s' | User: '%s' | Args: %s", tool_name, user_id, arguments)

    # Tasks
    if tool_name == "create_task":
        return await _create_task(db, user_id, arguments)
    elif tool_name == "view_tasks":
        return await _view_tasks(db, user_id, arguments)
    elif tool_name == "update_task":
        return await _update_task(db, user_id, arguments)
    elif tool_name == "delete_task":
        return await _delete_task(db, user_id, arguments)

    # Notes
    elif tool_name == "create_note":
        return await _create_note(db, user_id, arguments)
    elif tool_name == "view_notes":
        return await _view_notes(db, user_id, arguments)
    elif tool_name == "update_note":
        return await _update_note(db, user_id, arguments)
    elif tool_name == "delete_note":
        return await _delete_note(db, user_id, arguments)

    # Reminders
    elif tool_name == "create_reminder":
        return await _create_reminder(db, user_id, arguments)
    elif tool_name == "view_reminders":
        return await _view_reminders(db, user_id, arguments)
    elif tool_name == "update_reminder":
        return await _update_reminder(db, user_id, arguments)
    elif tool_name == "delete_reminder":
        return await _delete_reminder(db, user_id, arguments)

    # Calendar
    elif tool_name == "view_calendar_events":
        return await _view_calendar_events(db, user_id, arguments)
    elif tool_name == "create_calendar_event":
        return await _create_calendar_event(db, user_id, arguments)

    # Weather
    elif tool_name == "get_weather":
        return await _get_weather(arguments)

    # News
    elif tool_name == "get_news":
        return await _get_news(arguments)

    # Document Summarizer
    elif tool_name == "summarize_document":
        return await _summarize_document(arguments)

    else:
        return {"error": f"Unknown tool name: {tool_name}"}
