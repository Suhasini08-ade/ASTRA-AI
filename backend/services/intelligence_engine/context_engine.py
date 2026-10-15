"""Deterministic, read-only context selection for ASTRA requests."""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.services.intelligence_engine.schemas import (
    CalendarContext,
    FocusContext,
    IntelligenceContext,
    IntelligenceRequest,
    NoteContext,
    ReminderContext,
    TaskContext,
)

logger = logging.getLogger(__name__)


class ContextEngine:
    """Build a small, authenticated-user-scoped context without AI calls."""

    TASK_LIMIT = 8
    CALENDAR_LIMIT = 8
    REMINDER_LIMIT = 8
    NOTE_LIMIT = 5
    FOCUS_LIMIT = 5
    CHAT_LIMIT = 6
    CALENDAR_LOOKAHEAD_DAYS = 14

    _CATEGORY_KEYWORDS = {
        "tasks": ("task", "tasks", "todo", "to-do", "priority", "priorities", "deadline", "due", "work on", "complete", "finish"),
        "calendar": ("calendar", "schedule", "agenda", "meeting", "event", "appointment", "tonight", "today", "tomorrow"),
        "reminders": ("remind", "reminder", "reminders"),
        "notes": ("note", "notes", "write down", "saved", "save this"),
        "focus_sessions": ("focus", "pomodoro", "study session", "work session"),
    }
    _PLANNING_HINTS = ("what should", "plan", "organize", "productive", "work on", "prioritize", "priority", "tonight", "today")
    _CHAT_HINTS = ("as i said", "earlier", "previous", "last message", "we discussed", "that task", "that note")

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db

    async def build_context(self, user_id: str, message: str) -> IntelligenceContext:
        """Return relevant, bounded context belonging only to ``user_id``."""
        request = IntelligenceRequest(message=message.strip())
        now = datetime.now(timezone.utc)
        categories = self._select_categories(request.message)
        context = IntelligenceContext(
            request=request,
            current_time=now,
            relevant_categories=categories,
        )

        if "tasks" in categories:
            context.tasks = await self._load_tasks(user_id)
        if "calendar" in categories:
            context.calendar_events = await self._load_calendar_events(user_id, now)
        if "reminders" in categories:
            context.reminders = await self._load_reminders(user_id)
        if "notes" in categories:
            context.notes = await self._load_notes(user_id)
        if "focus_sessions" in categories:
            context.focus_sessions = await self._load_focus_sessions(user_id)
        if "settings" in categories:
            context.relevant_settings = await self._load_settings(user_id)
        if "recent_chat" in categories:
            context.recent_chat = await self._load_recent_chat(user_id)

        return context

    def _select_categories(self, message: str) -> list[str]:
        """Use transparent keyword hints rather than an AI classifier in Phase 1."""
        lowered = message.lower()
        categories = [
            category
            for category, keywords in self._CATEGORY_KEYWORDS.items()
            if any(keyword in lowered for keyword in keywords)
        ]

        if any(hint in lowered for hint in self._PLANNING_HINTS):
            for category in ("tasks", "calendar", "reminders", "focus_sessions", "settings"):
                if category not in categories:
                    categories.append(category)
        if any(hint in lowered for hint in self._CHAT_HINTS):
            categories.append("recent_chat")

        # Preserve deterministic order and prevent duplicate collection reads.
        return list(dict.fromkeys(categories))

    async def _load_tasks(self, user_id: str) -> list[TaskContext]:
        docs = await self._find_many(
            "tasks",
            {"user_id": user_id, "status": {"$ne": "done"}},
            {"title": 1, "description": 1, "due_date": 1, "priority": 1, "status": 1},
            [("due_date", 1), ("updated_at", -1)],
            self.TASK_LIMIT,
        )
        return [
            TaskContext(
                id=str(doc.get("_id", "")),
                title=str(doc.get("title", "Untitled task")),
                description=str(doc.get("description") or ""),
                due_date=self._datetime_or_none(doc.get("due_date")),
                priority=str(doc.get("priority") or "medium"),
                status=str(doc.get("status") or "todo"),
            )
            for doc in docs
        ]

    async def _load_calendar_events(self, user_id: str, now: datetime) -> list[CalendarContext]:
        docs = await self._find_many(
            "calendar_events",
            {"user_id": user_id, "start_time": {"$gte": now, "$lte": now + timedelta(days=self.CALENDAR_LOOKAHEAD_DAYS)}},
            {"title": 1, "description": 1, "start_time": 1, "end_time": 1},
            [("start_time", 1)],
            self.CALENDAR_LIMIT,
        )
        return [
            CalendarContext(
                id=str(doc.get("_id", "")),
                title=str(doc.get("title", "Untitled event")),
                description=str(doc.get("description") or ""),
                start_time=self._datetime_or_none(doc.get("start_time")),
                end_time=self._datetime_or_none(doc.get("end_time")),
            )
            for doc in docs
        ]

    async def _load_reminders(self, user_id: str) -> list[ReminderContext]:
        docs = await self._find_many(
            "reminders",
            {"user_id": user_id, "is_active": {"$ne": False}},
            {"message": 1, "due_time": 1, "repeat": 1, "is_active": 1},
            [("due_time", 1)],
            self.REMINDER_LIMIT,
        )
        return [
            ReminderContext(
                id=str(doc.get("_id", "")),
                message=str(doc.get("message", "Reminder")),
                due_time=self._datetime_or_none(doc.get("due_time")),
                repeat=doc.get("repeat") if isinstance(doc.get("repeat"), str) else None,
                is_active=doc.get("is_active", True) is not False,
            )
            for doc in docs
        ]

    async def _load_notes(self, user_id: str) -> list[NoteContext]:
        docs = await self._find_many(
            "notes",
            {"user_id": user_id},
            {"title": 1, "content": 1, "tags": 1, "updated_at": 1},
            [("updated_at", -1)],
            self.NOTE_LIMIT,
        )
        return [
            NoteContext(
                id=str(doc.get("_id", "")),
                title=str(doc.get("title") or "Untitled note"),
                content=str(doc.get("content") or ""),
                tags=self._string_list(doc.get("tags")),
                updated_at=self._datetime_or_none(doc.get("updated_at")),
            )
            for doc in docs
        ]

    async def _load_focus_sessions(self, user_id: str) -> list[FocusContext]:
        docs = await self._find_many(
            "focus_sessions",
            {"user_id": user_id},
            {"task_id": 1, "task_title": 1, "duration_seconds": 1, "status": 1, "timestamp": 1},
            [("timestamp", -1)],
            self.FOCUS_LIMIT,
        )
        return [
            FocusContext(
                id=str(doc.get("_id", "")),
                task_id=str(doc["task_id"]) if doc.get("task_id") is not None else None,
                task_title=str(doc.get("task_title") or ""),
                duration_seconds=self._non_negative_int(doc.get("duration_seconds")),
                status=str(doc.get("status") or ""),
                timestamp=self._datetime_or_none(doc.get("timestamp")),
            )
            for doc in docs
        ]

    async def _load_settings(self, user_id: str) -> dict[str, object]:
        """Expose only settings useful for interpreting a productivity request."""
        try:
            doc = await self._db.settings.find_one(
                {"user_id": user_id},
                {"_id": 0, "language": 1, "notifications_enabled": 1, "default_city": 1},
            )
            return doc or {}
        except Exception as exc:
            logger.warning("Context settings lookup failed: %s", exc)
            return {}

    async def _load_recent_chat(self, user_id: str) -> list[dict[str, object]]:
        docs = await self._find_many(
            "chat_messages",
            {"user_id": user_id},
            {"role": 1, "content": 1, "created_at": 1},
            [("created_at", -1)],
            self.CHAT_LIMIT,
        )
        docs.reverse()
        return [
            {
                "role": str(doc.get("role") or "user"),
                "content": str(doc.get("content") or ""),
                "created_at": self._datetime_or_none(doc.get("created_at")),
            }
            for doc in docs
        ]

    async def _find_many(
        self,
        collection_name: str,
        query: dict[str, Any],
        projection: dict[str, int],
        sort: list[tuple[str, int]],
        limit: int,
    ) -> list[dict[str, Any]]:
        """Safely execute one bounded collection read; return no data on failure."""
        try:
            collection = getattr(self._db, collection_name)
            cursor = collection.find(query, projection).sort(sort).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as exc:
            logger.warning("Context %s lookup failed: %s", collection_name, exc)
            return []

    @staticmethod
    def _datetime_or_none(value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
        return None

    @staticmethod
    def _non_negative_int(value: Any) -> int:
        try:
            return max(0, int(value))
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _string_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value if isinstance(item, (str, int, float))]
