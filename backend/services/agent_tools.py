"""
services/agent_tools.py
========================
OpenAI Function Calling (Tools) definitions and tool execution handlers
for the Jarvis AI Agent.

Reuses existing MongoDB collections and service layers without duplicate logic.
"""

from datetime import datetime, timedelta, timezone
import json
import logging
import re
from typing import Any

from bson import ObjectId
from bson.errors import BSONError
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

import urllib.parse

from backend.config import get_settings
from backend.services.desktop import desktop_service
from backend.services.knowledge_service import knowledge_service
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
            "description": "Update an existing task by ID or by title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "The MongoDB ID or title of the task to update.",
                    },
                    "title": {"type": "string", "description": "The current title or new title."},
                    "new_title": {"type": "string", "description": "Optional new title if renaming."},
                    "description": {"type": "string"},
                    "due_date": {
                        "type": "string",
                        "description": "ISO 8601 due date string or relative date like 'tomorrow'.",
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
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": "Delete a task by ID or by title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "string",
                        "description": "The MongoDB ID or title of the task to delete.",
                    },
                    "title": {
                        "type": "string",
                        "description": "The title of the task to delete.",
                    },
                },
                "required": [],
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
            "description": "Update an existing note by ID or by title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_id": {
                        "type": "string",
                        "description": "MongoDB ID or title of the note.",
                    },
                    "title": {"type": "string", "description": "Current title or new title."},
                    "content": {"type": "string"},
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_note",
            "description": "Delete a note by ID or by title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "note_id": {
                        "type": "string",
                        "description": "MongoDB ID or title of the note.",
                    },
                    "title": {"type": "string", "description": "The title of the note to delete."},
                },
                "required": [],
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
                        "description": "Due time in ISO 8601 format or relative time like 'tomorrow at 9am'.",
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
            "description": "Update an existing reminder by ID or by message.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {
                        "type": "string",
                        "description": "MongoDB ID or message/title of the reminder.",
                    },
                    "message": {"type": "string"},
                    "due_time": {
                        "type": "string",
                        "description": "ISO 8601 format due time or relative time.",
                    },
                    "repeat": {"type": "string"},
                    "is_active": {"type": "boolean"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_reminder",
            "description": "Delete a reminder by ID or by message.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reminder_id": {
                        "type": "string",
                        "description": "MongoDB ID or message/title of the reminder to delete.",
                    },
                    "message": {
                        "type": "string",
                        "description": "The reminder message to delete.",
                    },
                },
                "required": [],
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
                        "description": "Optional event end time (defaults to 1 hour after start_time).",
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
                "required": ["title", "start_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_calendar_event",
            "description": "Update an existing calendar event by ID or title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {
                        "type": "string",
                        "description": "MongoDB ID or title of the calendar event to update.",
                    },
                    "title": {"type": "string", "description": "Current title or new title."},
                    "description": {"type": "string"},
                    "start_time": {"type": "string", "description": "ISO 8601 start time."},
                    "end_time": {"type": "string", "description": "ISO 8601 end time."},
                    "color": {"type": "string"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_calendar_event",
            "description": "Delete a calendar event by ID or title.",
            "parameters": {
                "type": "object",
                "properties": {
                    "event_id": {
                        "type": "string",
                        "description": "MongoDB ID or title of the calendar event to delete.",
                    },
                    "title": {"type": "string", "description": "Title of the event to delete."},
                },
                "required": [],
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
    # --- KNOWLEDGE BASE & SEMANTIC SEARCH (QDRANT + ATLAS) ---
    {
        "type": "function",
        "function": {
            "name": "search_knowledge",
            "description": "Semantically search the user's private knowledge base, memory, notes, and documents in Qdrant.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language question or search phrase.",
                    },
                    "category": {
                        "type": "string",
                        "enum": ["general", "document", "note", "preference"],
                        "description": "Optional category filter.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of relevant results to return (default 5).",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_knowledge",
            "description": "Save important user facts, knowledge, notes, or long-term memory into Qdrant & MongoDB.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The information or memory text to store.",
                    },
                    "title": {
                        "type": "string",
                        "description": "Short title or label for this knowledge item.",
                    },
                    "category": {
                        "type": "string",
                        "enum": ["general", "document", "note", "preference"],
                        "description": "Category for organizational filtering.",
                    },
                },
                "required": ["text"],
            },
        },
    },


    # --- DAILY PLANNER ---
    {
        "type": "function",
        "function": {
            "name": "plan_my_day",
            "description": "Fetch and analyze all existing user data including tasks, notes, reminders, calendar events, deadlines, and priorities, to generate a personalized time-blocked daily schedule with breaks and conflict detection.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },

    # --- DESKTOP AUTOMATION ---
    {
        "type": "function",
        "function": {
            "name": "open_desktop_app",
            "description": (
                "Open an approved desktop application installed on the user's Windows computer "
                "(e.g., 'chrome', 'vscode', 'calculator', 'notepad', 'explorer', 'paint', 'spotify'). "
                "Only approved applications can be opened. Never pass arbitrary shell commands or executable paths."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {
                        "type": "string",
                        "description": (
                            "Name or alias of the approved application to launch (e.g., 'chrome', 'vscode', "
                            "'calculator', 'notepad', 'explorer', 'terminal', 'cmd', 'powershell', 'paint', "
                            "'task_manager', 'snipping_tool', 'word', 'excel', 'powerpoint', 'spotify', 'vlc')."
                        ),
                    },
                    "confirmed": {
                        "type": "boolean",
                        "description": "True only if the user explicitly confirmed launching a sensitive tool (such as command prompt or powershell).",
                    },
                },
                "required": ["app_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_website",
            "description": (
                "Open a validated HTTP or HTTPS website in the user's default web browser "
                "(e.g., 'https://youtube.com', 'https://github.com', or 'google.com')."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The website address or domain to open (e.g. 'https://youtube.com', 'github.com').",
                    },
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web_browser",
            "description": (
                "Search the web for a query using the user's default web browser. "
                "Opens Google Search with the search query in the browser."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search terms to look up on the web (e.g. 'Python tutorials', 'fastapi docs').",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_folder",
            "description": (
                "Open an approved folder or directory in Windows File Explorer "
                "(e.g. 'Downloads', 'Documents', 'Desktop', 'Pictures', or a valid project folder path)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_name": {
                        "type": "string",
                        "description": "The name or path of the folder to open (e.g. 'Downloads', 'Documents', 'Desktop').",
                    },
                },
                "required": ["folder_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "take_screenshot",
            "description": (
                "Take a screenshot of the user's desktop screen and save it to a designated, user-accessible folder "
                "(default is Pictures/Screenshots)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "folder": {
                        "type": "string",
                        "description": "Optional folder alias or path (e.g. 'Pictures/Screenshots', 'Desktop', 'Downloads').",
                    },
                    "filename": {
                        "type": "string",
                        "description": "Optional custom filename for the screenshot (e.g. 'preview.png').",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": (
                "Search for files by name or pattern inside an explicitly selected, permitted user folder "
                "(e.g. 'Documents', 'Downloads', 'Desktop', 'Pictures'). "
                "Whole-drive searches (like C:\\) are prohibited. Returns matching filenames and metadata without reading private file contents."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The file name, partial name, or search pattern (e.g. 'invoice', 'report.pdf', '*.docx').",
                    },
                    "folder": {
                        "type": "string",
                        "description": "The specific permitted folder to search inside (e.g. 'Documents', 'Downloads', 'Desktop', 'Pictures').",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of search results to return (default 20, max 50).",
                    },
                },
                "required": ["query", "folder"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_file",
            "description": (
                "Open a validated file with its default Windows application (e.g. opening a document, spreadsheet, PDF, or image). "
                "Executable or script files (.exe, .bat, .cmd, .ps1, etc.) require explicit user confirmation before opening."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to the file to open (e.g. 'C:\\Users\\Username\\Documents\\report.pdf').",
                    },
                    "confirmed": {
                        "type": "boolean",
                        "description": "True only if the user explicitly confirmed opening a sensitive executable or script file.",
                    },
                },
                "required": ["file_path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_datetime",
            "description": "Report the user's current local date, time, day of the week, and timezone.",
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
            "name": "control_volume",
            "description": (
                "Safely adjust Windows system volume or toggle mute. "
                "Actions: 'up' (increase volume), 'down' (decrease volume), 'mute' (toggle mute/unmute)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["up", "down", "mute", "unmute"],
                        "description": "Volume action to perform.",
                    },
                    "steps": {
                        "type": "integer",
                        "description": "Number of step increments (1 to 10, default 2).",
                    },
                },
                "required": ["action"],
            },
        },
    },
]


# ============================================================================
# 2. HELPER UTILITIES
# ============================================================================

def _parse_iso_datetime(dt_str: str | None) -> datetime | None:
    """Parse ISO or relative datetime string into UTC datetime object."""
    if not dt_str or not isinstance(dt_str, str):
        return None
    raw = dt_str.strip().lower()
    now = datetime.now(timezone.utc)

    # Relative shortcuts
    if raw in {"tomorrow", "tmrw"}:
        return (now + timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
    if raw in {"today", "tonight"}:
        return (now + timedelta(hours=3)).replace(minute=0, second=0, microsecond=0)
    if "tomorrow" in raw:
        time_match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", raw)
        hour, minute = 18, 0
        if time_match:
            h = int(time_match.group(1))
            m = int(time_match.group(2) or 0)
            ampm = (time_match.group(3) or "").lower()
            if ampm == "pm" and h < 12:
                h += 12
            elif ampm == "am" and h == 12:
                h = 0
            hour, minute = h, m
        return (now + timedelta(days=1)).replace(hour=hour, minute=minute, second=0, microsecond=0)

    try:
        clean_str = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        try:
            parts = [int(p) for p in re.findall(r"\d+", dt_str)]
            if len(parts) >= 3:
                return datetime(parts[0], parts[1], parts[2], 18, 0, 0, tzinfo=timezone.utc)
        except Exception:
            pass
        return None


def _format_datetime(dt: Any) -> str | None:
    """Format datetime object into ISO string."""
    if isinstance(dt, datetime):
        return dt.isoformat()
    return str(dt) if dt else None


def _format_human_datetime(dt_val: Any) -> str | None:
    """Format datetime object or ISO string into spoken human-friendly text.
    Never outputs raw timestamps, '0000', or timezone offsets (+00:00).
    """
    if not dt_val:
        return None
    dt: datetime | None = None
    if isinstance(dt_val, datetime):
        dt = dt_val
    elif isinstance(dt_val, str):
        dt = _parse_iso_datetime(dt_val)
    if not dt:
        return None

    now = datetime.now(timezone.utc)
    delta_days = (dt.date() - now.date()).days

    has_specific_time = not (dt.hour == 0 and dt.minute == 0 and dt.second == 0)
    time_str = ""
    if has_specific_time:
        minute_str = f":{dt.minute:02d}" if dt.minute != 0 else ""
        period = "AM" if dt.hour < 12 else "PM"
        hour_12 = dt.hour % 12
        if hour_12 == 0:
            hour_12 = 12
        time_str = f" at {hour_12}{minute_str} {period}"

    if delta_days == 0:
        day_str = "today"
    elif delta_days == 1:
        day_str = "tomorrow"
    elif delta_days == -1:
        day_str = "yesterday"
    elif 1 < delta_days < 7:
        day_str = dt.strftime("%A")
    else:
        if dt.year == now.year:
            day_str = dt.strftime("%B ") + str(dt.day)
        else:
            day_str = dt.strftime("%B ") + str(dt.day) + f", {dt.year}"

    return f"{day_str}{time_str}".strip()


async def _resolve_item(
    collection,
    user_id: str,
    id_val: Any = None,
    title_val: Any = None,
    title_field: str = "title",
) -> dict[str, Any] | None:
    """Resolve an item from MongoDB by ObjectId or by case-insensitive title/message search."""
    # 1. Try direct ObjectId lookup
    if id_val and isinstance(id_val, str) and ObjectId.is_valid(id_val):
        doc = await collection.find_one({"_id": ObjectId(id_val), "user_id": user_id})
        if doc:
            return doc

    # 2. Extract search term
    search_term = ""
    if title_val and isinstance(title_val, str) and title_val.strip():
        search_term = title_val.strip().strip("'\"").rstrip(".!?:")
    elif id_val and isinstance(id_val, str) and id_val.strip() and not ObjectId.is_valid(id_val):
        search_term = id_val.strip().strip("'\"").rstrip(".!?:")

    if not search_term:
        return None

    # 3. Clean search term (remove leading/trailing articles and resource keywords)
    cleaned = re.sub(
        r"\b(my|the|this|that|task|todo|to-do|note|reminder|event|meeting|named|called)\b",
        "",
        search_term,
        flags=re.I,
    ).strip().strip("'\"").rstrip(".!?:")

    # 4. Exact match on search_term
    doc = await collection.find_one({
        "user_id": user_id,
        title_field: {"$regex": f"^{re.escape(search_term)}$", "$options": "i"},
    })
    if doc:
        return doc

    # 5. Exact match on cleaned term
    if cleaned and cleaned != search_term:
        doc = await collection.find_one({
            "user_id": user_id,
            title_field: {"$regex": f"^{re.escape(cleaned)}$", "$options": "i"},
        })
        if doc:
            return doc

    # 6. Partial match on search_term
    doc = await collection.find_one({
        "user_id": user_id,
        title_field: {"$regex": re.escape(search_term), "$options": "i"},
    })
    if doc:
        return doc

    # 7. Partial match on cleaned term
    if cleaned and cleaned != search_term:
        doc = await collection.find_one({
            "user_id": user_id,
            title_field: {"$regex": re.escape(cleaned), "$options": "i"},
        })
        if doc:
            return doc

    return None


# ============================================================================
# 3. TOOL EXECUTION HANDLERS
# ============================================================================

# --- Tasks Handlers ---

async def _create_task(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    title = args.get("title", "").strip().strip("'\"").rstrip(".!?:")
    if not title:
        return {"error": "Task title is required."}

    now = datetime.now(timezone.utc)

    # Duplicate prevention: if identical task was created within the last 15 seconds, return it
    recent_dup = await db.tasks.find_one({
        "user_id": user_id,
        "title": {"$regex": f"^{re.escape(title)}$", "$options": "i"},
        "created_at": {"$gte": now - timedelta(seconds=15)},
    })
    if recent_dup:
        return {
            "status": "success",
            "message": f"Task '{title}' already created.",
            "task": {
                "id": str(recent_dup["_id"]),
                "title": recent_dup["title"],
                "description": recent_dup.get("description", ""),
                "due_date": _format_datetime(recent_dup.get("due_date")),
                "priority": recent_dup.get("priority", "medium"),
                "status": recent_dup.get("status", "todo"),
            },
        }

    description = args.get("description", "")
    priority = args.get("priority", "medium")
    status_val = args.get("status", "todo")
    due_date = _parse_iso_datetime(args.get("due_date"))

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
        due_h = _format_human_datetime(due_date)
        msg = f"Task '{title}' created for {due_h}." if due_h else f"Task '{title}' created successfully."
        return {
            "status": "success",
            "message": msg,
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

        if not tasks:
            msg = "You have no pending tasks." if status_val == "todo" else "You have no tasks."
        elif len(tasks) == 1:
            t = tasks[0]
            d_str = f" due {_format_human_datetime(t.get('due_date'))}" if t.get("due_date") else ""
            msg = f"You have 1 task: '{t['title']}'{d_str}."
        else:
            t_names = [f"'{t['title']}'" for t in tasks[:4]]
            more_str = f" and {len(tasks) - 4} more" if len(tasks) > 4 else ""
            msg = f"You have {len(tasks)} tasks: {', '.join(t_names)}{more_str}."

        return {"status": "success", "count": len(tasks), "tasks": tasks, "message": msg}
    except PyMongoError as exc:
        logger.error("Error in view_tasks tool: %s", exc)
        return {"error": "Failed to fetch tasks from database."}


async def _update_task(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    task_id = args.get("task_id")
    title_search = args.get("title")

    task = await _resolve_item(db.tasks, user_id, task_id, title_search)
    if not task:
        return {"error": "Task not found. Please specify the title or ID of the task to update."}

    update_fields: dict[str, Any] = {}
    if "new_title" in args and args["new_title"]:
        update_fields["title"] = args["new_title"].strip()
    elif "title" in args and args["title"] and not task_id:
        pass
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
            {"_id": task["_id"], "user_id": user_id},
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            return {"error": "Task not found."}

        res_title = result.get('title') or title_search or "Task"
        if update_fields.get("status") == "done":
            msg = f"Task '{res_title}' marked as completed."
        elif "priority" in update_fields:
            msg = f"Task '{res_title}' priority updated to {update_fields['priority']}."
        elif "due_date" in update_fields:
            due_h = _format_human_datetime(update_fields["due_date"])
            msg = f"Task '{res_title}' due date updated to {due_h}." if due_h else f"Task '{res_title}' updated successfully."
        elif "title" in update_fields:
            msg = f"Task renamed to '{update_fields['title']}'."
        else:
            msg = f"Task '{res_title}' updated successfully."

        return {
            "status": "success",
            "message": msg,
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
    title = args.get("title")

    task = await _resolve_item(db.tasks, user_id, task_id, title)
    if not task:
        return {"error": "Task not found. Please specify the title or ID of the task to delete."}

    try:
        result = await db.tasks.delete_one({"_id": task["_id"], "user_id": user_id})
        if result.deleted_count == 0:
            return {"error": "Task not found."}
        task_title = task.get('title', '')
        msg = f"Task '{task_title}' deleted successfully." if task_title else "Task deleted successfully."
        return {
            "status": "success",
            "message": msg,
        }
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in delete_task tool: %s", exc)
        return {"error": "Failed to delete task from database."}


# --- Notes Handlers ---

async def _create_note(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    title = args.get("title", "").strip()
    content = args.get("content", "").strip()
    if not title or not content:
        return {"error": "Both title and content are required to create a note."}

    now = datetime.now(timezone.utc)

    # Duplicate prevention: if identical note was created within the last 15 seconds, return it
    recent_dup = await db.notes.find_one({
        "user_id": user_id,
        "title": {"$regex": f"^{re.escape(title)}$", "$options": "i"},
        "created_at": {"$gte": now - timedelta(seconds=15)},
    })
    if recent_dup:
        return {
            "status": "success",
            "message": f"Note '{title}' already exists.",
            "note": {
                "id": str(recent_dup["_id"]),
                "title": recent_dup["title"],
                "content": recent_dup.get("content", ""),
                "tags": recent_dup.get("tags", []),
            },
        }

    tags = args.get("tags", [])
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
            "message": f"Note '{title}' saved successfully.",
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
        if not notes:
            msg = "You have no saved notes."
        elif len(notes) == 1:
            msg = f"You have 1 note: '{notes[0]['title']}'."
        else:
            n_titles = [f"'{n['title']}'" for n in notes[:4]]
            more_str = f" and {len(notes) - 4} more" if len(notes) > 4 else ""
            msg = f"You have {len(notes)} notes: {', '.join(n_titles)}{more_str}."
        return {"status": "success", "message": msg, "count": len(notes), "notes": notes}
    except PyMongoError as exc:
        logger.error("Error in view_notes tool: %s", exc)
        return {"error": "Failed to fetch notes from database."}


async def _update_note(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    note_id = args.get("note_id")
    title_search = args.get("title")

    note = await _resolve_item(db.notes, user_id, note_id, title_search)
    if not note:
        return {"error": "Note not found. Please specify the title or ID of the note to update."}

    update_fields: dict[str, Any] = {}
    if "new_title" in args and args["new_title"]:
        update_fields["title"] = args["new_title"].strip()
    if "content" in args and args["content"]:
        update_fields["content"] = args["content"].strip()
    if "tags" in args and isinstance(args["tags"], list):
        update_fields["tags"] = args["tags"]

    if not update_fields:
        return {"error": "No valid fields specified for update."}

    update_fields["updated_at"] = datetime.now(timezone.utc)

    try:
        result = await db.notes.find_one_and_update(
            {"_id": note["_id"], "user_id": user_id},
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            return {"error": "Note not found."}
        note_title = result.get('title') or "Note"
        return {
            "status": "success",
            "message": f"Note '{note_title}' updated successfully.",
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
    title = args.get("title")

    note = await _resolve_item(db.notes, user_id, note_id, title)
    if not note:
        return {"error": "Note not found. Please specify the title or ID of the note to delete."}

    try:
        result = await db.notes.delete_one({"_id": note["_id"], "user_id": user_id})
        if result.deleted_count == 0:
            return {"error": "Note not found."}
        note_title = note.get('title', '')
        msg = f"Note '{note_title}' deleted successfully." if note_title else "Note deleted successfully."
        return {"status": "success", "message": msg}
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in delete_note tool: %s", exc)
        return {"error": "Failed to delete note from database."}


# --- Reminders Handlers ---

async def _create_reminder(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    message = args.get("message", "").strip()
    due_time_raw = args.get("due_time")
    due_time = _parse_iso_datetime(due_time_raw)
    if not message or not due_time:
        return {"error": "Both message and valid due_time are required to create a reminder."}

    now = datetime.now(timezone.utc)

    # Duplicate prevention: if identical reminder was created within the last 15 seconds, return it
    recent_dup = await db.reminders.find_one({
        "user_id": user_id,
        "message": {"$regex": f"^{re.escape(message)}$", "$options": "i"},
        "created_at": {"$gte": now - timedelta(seconds=15)},
    })
    if recent_dup:
        human_due = _format_human_datetime(recent_dup.get("due_time"))
        msg = f"Reminder '{message}' is already set for {human_due}." if human_due else f"Reminder '{message}' already created."
        return {
            "status": "success",
            "message": msg,
            "reminder": {
                "id": str(recent_dup["_id"]),
                "message": recent_dup["message"],
                "due_time": _format_datetime(recent_dup.get("due_time")),
                "repeat": recent_dup.get("repeat"),
            },
        }

    repeat = args.get("repeat")
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
        human_due = _format_human_datetime(due_time)
        msg = f"Reminder set for '{message}' {human_due}." if human_due else f"Reminder set for '{message}'."
        return {
            "status": "success",
            "message": msg,
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
        if not reminders:
            msg = "You have no active reminders."
        elif len(reminders) == 1:
            r = reminders[0]
            d_str = f" for {_format_human_datetime(r.get('due_time'))}" if r.get("due_time") else ""
            msg = f"You have 1 reminder: '{r['message']}'{d_str}."
        else:
            r_summaries = []
            for r in reminders[:3]:
                d_str = f" ({_format_human_datetime(r.get('due_time'))})" if r.get("due_time") else ""
                r_summaries.append(f"'{r['message']}'{d_str}")
            more_str = f" and {len(reminders) - 3} more" if len(reminders) > 3 else ""
            msg = f"You have {len(reminders)} reminders: {', '.join(r_summaries)}{more_str}."
        return {"status": "success", "message": msg, "count": len(reminders), "reminders": reminders}
    except PyMongoError as exc:
        logger.error("Error in view_reminders tool: %s", exc)
        return {"error": "Failed to fetch reminders from database."}


async def _update_reminder(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    reminder_id = args.get("reminder_id")
    msg_search = args.get("message") or args.get("title")

    reminder = await _resolve_item(db.reminders, user_id, reminder_id, msg_search, title_field="message")
    if not reminder:
        return {"error": "Reminder not found. Please specify the message or ID of the reminder to update."}

    update_fields: dict[str, Any] = {}
    if "new_message" in args and args["new_message"]:
        update_fields["message"] = args["new_message"].strip()
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
            {"_id": reminder["_id"], "user_id": user_id},
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            return {"error": "Reminder not found."}

        updated_msg = result.get("message", "")
        if "is_active" in update_fields and not update_fields["is_active"]:
            msg = f"Reminder '{updated_msg}' marked as completed."
        elif "due_time" in update_fields and update_fields["due_time"]:
            human_due = _format_human_datetime(update_fields["due_time"])
            msg = f"Reminder '{updated_msg}' rescheduled for {human_due}." if human_due else f"Reminder '{updated_msg}' updated successfully."
        else:
            msg = f"Reminder '{updated_msg}' updated successfully."

        return {
            "status": "success",
            "message": msg,
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
    message = args.get("message") or args.get("title")

    reminder = await _resolve_item(db.reminders, user_id, reminder_id, message, title_field="message")
    if not reminder:
        return {"error": "Reminder not found. Please specify the message or ID of the reminder to delete."}

    try:
        result = await db.reminders.delete_one({"_id": reminder["_id"], "user_id": user_id})
        if result.deleted_count == 0:
            return {"error": "Reminder not found."}
        rem_msg = reminder.get('message', '')
        msg = f"Reminder '{rem_msg}' deleted successfully." if rem_msg else "Reminder deleted successfully."
        return {"status": "success", "message": msg}
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
        if not events:
            msg = "You have no upcoming calendar events."
        elif len(events) == 1:
            e = events[0]
            d_str = f" for {_format_human_datetime(e.get('start_time'))}" if e.get("start_time") else ""
            msg = f"You have 1 calendar event: '{e['title']}'{d_str}."
        else:
            e_summaries = []
            for e in events[:3]:
                d_str = f" ({_format_human_datetime(e.get('start_time'))})" if e.get("start_time") else ""
                e_summaries.append(f"'{e['title']}'{d_str}")
            more_str = f" and {len(events) - 3} more" if len(events) > 3 else ""
            msg = f"You have {len(events)} calendar events: {', '.join(e_summaries)}{more_str}."
        return {"status": "success", "message": msg, "count": len(events), "events": events}
    except PyMongoError as exc:
        logger.error("Error in view_calendar_events tool: %s", exc)
        return {"error": "Failed to fetch calendar events from database."}


async def _create_calendar_event(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    title = args.get("title", "").strip()
    start_time = _parse_iso_datetime(args.get("start_time"))
    if not title or not start_time:
        return {"error": "Title and valid start_time are required for calendar event."}

    # Default end_time to 1 hour after start_time if not explicitly provided
    end_time = _parse_iso_datetime(args.get("end_time"))
    if not end_time:
        end_time = start_time + timedelta(hours=1)

    now = datetime.now(timezone.utc)

    # Duplicate prevention: if identical event was scheduled within the last 15 seconds, return it
    recent_dup = await db.calendar_events.find_one({
        "user_id": user_id,
        "title": {"$regex": f"^{re.escape(title)}$", "$options": "i"},
        "created_at": {"$gte": now - timedelta(seconds=15)},
    })
    if recent_dup:
        start_h = _format_human_datetime(recent_dup.get("start_time"))
        msg = f"Calendar event '{title}' is already scheduled for {start_h}." if start_h else f"Calendar event '{title}' already scheduled."
        return {
            "status": "success",
            "message": msg,
            "event": {
                "id": str(recent_dup["_id"]),
                "title": recent_dup["title"],
                "description": recent_dup.get("description", ""),
                "start_time": _format_datetime(recent_dup.get("start_time")),
                "end_time": _format_datetime(recent_dup.get("end_time")),
                "color": recent_dup.get("color", "#4f46e5"),
            },
        }

    description = args.get("description", "")
    color = args.get("color", "#4f46e5")

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
        start_h = _format_human_datetime(start_time)
        msg = f"Calendar event '{title}' scheduled for {start_h}." if start_h else f"Calendar event '{title}' scheduled successfully."
        return {
            "status": "success",
            "message": msg,
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


async def _update_calendar_event(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    event_id = args.get("event_id")
    title_search = args.get("title")

    event = await _resolve_item(db.calendar_events, user_id, event_id, title_search)
    if not event:
        return {"error": "Calendar event not found. Please specify the title or ID of the event to update."}

    update_fields: dict[str, Any] = {}
    if "new_title" in args and args["new_title"]:
        update_fields["title"] = args["new_title"].strip()
    if "description" in args and args["description"] is not None:
        update_fields["description"] = args["description"]
    if "start_time" in args and args["start_time"]:
        update_fields["start_time"] = _parse_iso_datetime(args["start_time"])
    if "end_time" in args and args["end_time"]:
        update_fields["end_time"] = _parse_iso_datetime(args["end_time"])
    if "color" in args and args["color"]:
        update_fields["color"] = args["color"]

    if not update_fields:
        return {"error": "No valid fields specified for update."}

    try:
        result = await db.calendar_events.find_one_and_update(
            {"_id": event["_id"], "user_id": user_id},
            {"$set": update_fields},
            return_document=True,
        )
        if not result:
            return {"error": "Calendar event not found."}

        event_title = result.get('title', '')
        if "start_time" in update_fields and update_fields["start_time"]:
            start_h = _format_human_datetime(update_fields["start_time"])
            msg = f"Calendar event '{event_title}' rescheduled for {start_h}." if start_h else f"Calendar event '{event_title}' updated successfully."
        else:
            msg = f"Calendar event '{event_title}' updated successfully."

        return {
            "status": "success",
            "message": msg,
            "event": {
                "id": str(result["_id"]),
                "title": result.get("title"),
                "description": result.get("description"),
                "start_time": _format_datetime(result.get("start_time")),
                "end_time": _format_datetime(result.get("end_time")),
                "color": result.get("color"),
            },
        }
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in update_calendar_event tool: %s", exc)
        return {"error": "Failed to update calendar event in database."}


async def _delete_calendar_event(db: AsyncIOMotorDatabase, user_id: str, args: dict[str, Any]) -> dict[str, Any]:
    event_id = args.get("event_id")
    title = args.get("title")

    event = await _resolve_item(db.calendar_events, user_id, event_id, title)
    if not event:
        return {"error": "Calendar event not found. Please specify the title or ID of the event to delete."}

    try:
        result = await db.calendar_events.delete_one({"_id": event["_id"], "user_id": user_id})
        if result.deleted_count == 0:
            return {"error": "Calendar event not found."}
        event_title = event.get('title', '')
        msg = f"Calendar event '{event_title}' deleted successfully." if event_title else "Calendar event deleted successfully."
        return {
            "status": "success",
            "message": msg,
        }
    except (PyMongoError, BSONError) as exc:
        logger.error("Error in delete_calendar_event tool: %s", exc)
        return {"error": "Failed to delete calendar event from database."}



# --- Weather Handler ---

async def _get_weather(args: dict[str, Any]) -> dict[str, Any]:
    location = args.get("location", "Latur").strip() or "Latur"
    try:
        current = await weather_service.get_current_weather(city=location)
        forecast_raw = await weather_service.get_forecast(city=location)
        forecast_list = forecast_raw.get("forecasts", [])
        compact_forecast = forecast_list[::8][:4] if forecast_list else []
        return {
            "status": "success",
            "location": location,
            "current": current,
            "forecast": compact_forecast,
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


# --- Desktop Automation Handlers ---

async def _open_desktop_app(arguments: dict[str, Any]) -> dict[str, Any]:
    raw_app = str(arguments.get("app_name", "")).strip()
    if not raw_app:
        return {"status": "error", "error": "Application name is required."}

    # Redirect web domains or URLs if inadvertently routed as app names
    lowered = raw_app.lower()
    if lowered in ("youtube", "github", "google", "gmail", "reddit", "twitter", "linkedin") or "://" in raw_app:
        return await _open_website({"url": raw_app})

    # Sensitive command-line tools require confirmation
    confirmed = bool(arguments.get("confirmed", False))
    if lowered in ("cmd", "command prompt", "powershell", "windows powershell"):
        if not confirmed:
            return {
                "status": "requires_confirmation",
                "action": "open_desktop_app",
                "app_name": raw_app,
                "message": (
                    f"Launching {raw_app} provides command-line terminal access to your computer. "
                    "Please confirm if you wish to proceed."
                ),
            }

    result = desktop_service.open_app(raw_app)
    if result.get("success"):
        return {
            "status": "success",
            "action": "open_desktop_app",
            "target": result.get("target"),
            "resolved_path": result.get("resolved_path"),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "open_desktop_app",
        "target": result.get("target", raw_app),
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _open_website(arguments: dict[str, Any]) -> dict[str, Any]:
    raw_url = str(arguments.get("url", "")).strip()
    if not raw_url:
        return {"status": "error", "error": "Website URL is required."}

    result = desktop_service.open_website(raw_url)
    if result.get("success"):
        return {
            "status": "success",
            "action": "open_website",
            "target": result.get("target"),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "open_website",
        "target": result.get("target", raw_url),
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _search_web_browser(arguments: dict[str, Any]) -> dict[str, Any]:
    raw_query = str(arguments.get("query", "")).strip()
    if not raw_query:
        return {"status": "error", "error": "Search query is required."}

    encoded = urllib.parse.quote_plus(raw_query)
    search_url = f"https://www.google.com/search?q={encoded}"
    result = desktop_service.open_website(search_url)
    if result.get("success"):
        return {
            "status": "success",
            "action": "search_web_browser",
            "query": raw_query,
            "url": search_url,
            "message": f"Successfully searched the web for '{raw_query}'.",
        }
    return {
        "status": "error",
        "action": "search_web_browser",
        "query": raw_query,
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _open_folder(arguments: dict[str, Any]) -> dict[str, Any]:
    raw_folder = str(arguments.get("folder_name", "")).strip()
    if not raw_folder:
        return {"status": "error", "error": "Folder name or path is required."}

    result = desktop_service.open_folder(raw_folder)
    if result.get("success"):
        return {
            "status": "success",
            "action": "open_folder",
            "target": result.get("target"),
            "path": result.get("resolved_path"),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "open_folder",
        "target": result.get("target", raw_folder),
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _take_screenshot(arguments: dict[str, Any]) -> dict[str, Any]:
    folder = arguments.get("folder")
    filename = arguments.get("filename")
    result = desktop_service.take_screenshot(folder=folder, filename=filename)
    if result.get("success"):
        return {
            "status": "success",
            "action": "take_screenshot",
            "file_name": result.get("details", {}).get("file_name"),
            "folder": result.get("details", {}).get("folder"),
            "full_path": result.get("resolved_path"),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "take_screenshot",
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _search_files(arguments: dict[str, Any]) -> dict[str, Any]:
    query = str(arguments.get("query", "")).strip()
    folder = str(arguments.get("folder", "")).strip()
    limit = int(arguments.get("limit", 20))

    if not query:
        return {
            "status": "error",
            "action": "search_files",
            "message": "Filename or search query is required. Please specify what file to search for.",
            "error": "Missing query.",
        }

    if not folder:
        return {
            "status": "needs_clarification",
            "action": "search_files",
            "message": "Please specify which permitted folder to search (e.g. Documents, Downloads, Desktop, Pictures).",
            "error": "Missing search folder.",
        }

    result = desktop_service.search_files(query=query, folder=folder, limit=limit)
    if result.get("success"):
        return {
            "status": "success",
            "action": "search_files",
            "query": query,
            "folder": result.get("resolved_path"),
            "count": result.get("details", {}).get("count", 0),
            "files": result.get("details", {}).get("files", []),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "search_files",
        "query": query,
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _open_file(arguments: dict[str, Any]) -> dict[str, Any]:
    file_path = str(arguments.get("file_path", "")).strip()
    confirmed = bool(arguments.get("confirmed", False))

    if not file_path:
        return {"status": "error", "action": "open_file", "error": "File path is required."}

    result = desktop_service.open_file(file_path=file_path, confirmed=confirmed)
    details = result.get("details", {})
    if details.get("requires_confirmation"):
        return {
            "status": "requires_confirmation",
            "action": "open_file",
            "file_name": details.get("file_name"),
            "path": details.get("path"),
            "message": result.get("message"),
        }

    if result.get("success"):
        return {
            "status": "success",
            "action": "open_file",
            "target": result.get("target"),
            "path": result.get("resolved_path"),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "open_file",
        "target": result.get("target", file_path),
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _get_current_datetime() -> dict[str, Any]:
    result = desktop_service.get_local_datetime()
    if result.get("success"):
        details = result.get("details", {})
        return {
            "status": "success",
            "action": "get_current_datetime",
            "time": details.get("time"),
            "date": details.get("date"),
            "day_of_week": details.get("day_of_week"),
            "timezone": details.get("timezone"),
            "iso_timestamp": details.get("iso_timestamp"),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "get_current_datetime",
        "error": result.get("error"),
        "message": result.get("message"),
    }


async def _control_volume(arguments: dict[str, Any]) -> dict[str, Any]:
    action = str(arguments.get("action", "")).strip()
    steps = int(arguments.get("steps", 2))

    if not action:
        return {"status": "error", "action": "control_volume", "error": "Volume action is required."}

    result = desktop_service.control_volume(action=action, steps=steps)
    if result.get("success"):
        return {
            "status": "success",
            "action": "control_volume",
            "target": result.get("target"),
            "steps": result.get("details", {}).get("steps"),
            "message": result.get("message"),
        }
    return {
        "status": "error",
        "action": "control_volume",
        "target": result.get("target", action),
        "error": result.get("error"),
        "message": result.get("message"),
    }


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

    # Daily Planner
    elif tool_name == "plan_my_day":
        from backend.services.daily_planner import daily_planner
        plan_res = await daily_planner.generate_daily_plan(db, user_id)
        return {
            "status": "success",
            "message": plan_res["reply"],
            "spoken_summary": plan_res["spoken_summary"],
        }

    # Calendar
    elif tool_name == "view_calendar_events":
        return await _view_calendar_events(db, user_id, arguments)
    elif tool_name == "create_calendar_event":
        return await _create_calendar_event(db, user_id, arguments)
    elif tool_name == "update_calendar_event":
        return await _update_calendar_event(db, user_id, arguments)
    elif tool_name == "delete_calendar_event":
        return await _delete_calendar_event(db, user_id, arguments)

    # Weather
    elif tool_name == "get_weather":
        return await _get_weather(arguments)

    # News
    elif tool_name == "get_news":
        return await _get_news(arguments)

    # Document Summarizer
    elif tool_name == "summarize_document":
        return await _summarize_document(arguments)

    # Knowledge Base & Semantic Search (Qdrant + Atlas)
    elif tool_name == "search_knowledge":
        query = arguments.get("query", "").strip()
        category = arguments.get("category")
        limit = int(arguments.get("limit", 5))
        try:
            results = await knowledge_service.search_knowledge(
                user_id=user_id,
                query=query,
                category=category,
                limit=limit,
            )
            return {
                "status": "success",
                "count": len(results),
                "query": query,
                "results": results,
            }
        except Exception as exc:
            logger.error("Error executing search_knowledge tool: %s", exc)
            return {"status": "error", "message": str(exc), "results": []}

    elif tool_name == "save_knowledge":
        text = arguments.get("text", "").strip()
        title = arguments.get("title")
        category = arguments.get("category", "general")
        try:
            saved = await knowledge_service.save_knowledge_item(
                db=db,
                user_id=user_id,
                text=text,
                title=title,
                category=category,
            )
            return {
                "status": "success",
                "message": f"Successfully stored in private knowledge base under '{category}'.",
                "item": saved,
            }
        except Exception as exc:
            logger.error("Error executing save_knowledge tool: %s", exc)
            return {"status": "error", "message": str(exc)}

    # Desktop Automation
    elif tool_name == "open_desktop_app":
        return await _open_desktop_app(arguments)
    elif tool_name == "open_website":
        return await _open_website(arguments)
    elif tool_name == "search_web_browser":
        return await _search_web_browser(arguments)
    elif tool_name == "open_folder":
        return await _open_folder(arguments)
    elif tool_name == "take_screenshot":
        return await _take_screenshot(arguments)
    elif tool_name == "search_files":
        return await _search_files(arguments)
    elif tool_name == "open_file":
        return await _open_file(arguments)
    elif tool_name == "get_current_datetime":
        return await _get_current_datetime()
    elif tool_name == "control_volume":
        return await _control_volume(arguments)

    else:
        return {"error": f"Unknown tool name: {tool_name}"}
