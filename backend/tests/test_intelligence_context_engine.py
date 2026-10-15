"""Focused tests for Phase 1's read-only ASTRA Context Engine."""

from datetime import datetime, timedelta, timezone
import unittest

from backend.services.intelligence_engine.context_engine import ContextEngine
from backend.services.intelligence_engine.engine import IntelligenceEngine


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents
        self.sort_value = None
        self.limit_value = None

    def sort(self, value):
        self.sort_value = value
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    async def to_list(self, length):
        return self.documents[: min(length, self.limit_value or length)]


class FakeCollection:
    def __init__(self, documents=None, one=None):
        self.documents = documents or []
        self.one = one
        self.find_calls = []
        self.find_one_calls = []
        self.last_cursor = None

    def find(self, query, projection):
        self.find_calls.append((query, projection))
        self.last_cursor = FakeCursor(self.documents)
        return self.last_cursor

    async def find_one(self, query, projection):
        self.find_one_calls.append((query, projection))
        return self.one


class FakeDatabase:
    def __init__(self):
        self.tasks = FakeCollection()
        self.calendar_events = FakeCollection()
        self.reminders = FakeCollection()
        self.notes = FakeCollection()
        self.focus_sessions = FakeCollection()
        self.settings = FakeCollection()
        self.chat_messages = FakeCollection()


class ContextEngineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = FakeDatabase()
        self.engine = ContextEngine(self.db)

    async def test_context_creation_for_productivity_request(self):
        context = await self.engine.build_context("user-a", "What should I work on tonight?")

        self.assertEqual(context.request.message, "What should I work on tonight?")
        self.assertIn("tasks", context.relevant_categories)
        self.assertIn("calendar", context.relevant_categories)
        self.assertIn("reminders", context.relevant_categories)
        self.assertIn("focus_sessions", context.relevant_categories)
        self.assertIn("settings", context.relevant_categories)

    async def test_empty_user_data_returns_safe_empty_context(self):
        context = await self.engine.build_context("user-a", "What should I work on today?")

        self.assertEqual(context.tasks, [])
        self.assertEqual(context.calendar_events, [])
        self.assertEqual(context.reminders, [])
        self.assertEqual(context.focus_sessions, [])
        self.assertEqual(context.relevant_settings, {})

    async def test_task_retrieval_is_owned_and_bounded(self):
        self.db.tasks.documents = [
            {"_id": str(index), "user_id": "user-a", "title": f"Task {index}"}
            for index in range(ContextEngine.TASK_LIMIT + 3)
        ]

        context = await self.engine.build_context("user-a", "Show my tasks")

        self.assertEqual(len(context.tasks), ContextEngine.TASK_LIMIT)
        query, _ = self.db.tasks.find_calls[0]
        self.assertEqual(query["user_id"], "user-a")
        self.assertEqual(query["status"], {"$ne": "done"})
        self.assertEqual(self.db.tasks.last_cursor.limit_value, ContextEngine.TASK_LIMIT)

    async def test_calendar_retrieval_is_owned_and_upcoming(self):
        start = datetime.now(timezone.utc) + timedelta(hours=2)
        self.db.calendar_events.documents = [{"_id": "event-1", "title": "Study", "start_time": start}]

        context = await self.engine.build_context("user-a", "What is on my calendar tomorrow?")

        self.assertEqual(context.calendar_events[0].title, "Study")
        query, _ = self.db.calendar_events.find_calls[0]
        self.assertEqual(query["user_id"], "user-a")
        self.assertIn("$gte", query["start_time"])
        self.assertIn("$lte", query["start_time"])

    async def test_reminder_retrieval_excludes_inactive_and_is_owned(self):
        self.db.reminders.documents = [{"_id": "rem-1", "message": "Study DAA", "is_active": True}]

        context = await self.engine.build_context("user-a", "Show my reminders")

        self.assertEqual(context.reminders[0].message, "Study DAA")
        query, _ = self.db.reminders.find_calls[0]
        self.assertEqual(query, {"user_id": "user-a", "is_active": {"$ne": False}})

    async def test_irrelevant_collections_are_not_loaded(self):
        context = await self.engine.build_context("user-a", "Tell me a joke")

        self.assertEqual(context.relevant_categories, [])
        self.assertEqual(self.db.tasks.find_calls, [])
        self.assertEqual(self.db.calendar_events.find_calls, [])
        self.assertEqual(self.db.reminders.find_calls, [])
        self.assertEqual(self.db.notes.find_calls, [])
        self.assertEqual(self.db.focus_sessions.find_calls, [])
        self.assertEqual(self.db.chat_messages.find_calls, [])
        self.assertEqual(self.db.settings.find_one_calls, [])

    async def test_malformed_optional_data_is_normalized_safely(self):
        self.db.notes.documents = [{"_id": "note-1", "title": None, "content": None, "tags": "not-a-list", "updated_at": "bad-date"}]
        self.db.focus_sessions.documents = [{"_id": "focus-1", "duration_seconds": "invalid", "timestamp": "bad-date"}]

        context = await self.engine.build_context("user-a", "Review my notes and focus sessions")

        self.assertEqual(context.notes[0].title, "Untitled note")
        self.assertEqual(context.notes[0].tags, [])
        self.assertIsNone(context.notes[0].updated_at)
        self.assertEqual(context.focus_sessions[0].duration_seconds, 0)
        self.assertIsNone(context.focus_sessions[0].timestamp)

    async def test_multiple_users_are_query_isolated(self):
        await self.engine.build_context("user-a", "Show my tasks and notes")
        await self.engine.build_context("user-b", "Show my tasks and notes")

        task_queries = [call[0]["user_id"] for call in self.db.tasks.find_calls]
        note_queries = [call[0]["user_id"] for call in self.db.notes.find_calls]
        self.assertEqual(task_queries, ["user-a", "user-b"])
        self.assertEqual(note_queries, ["user-a", "user-b"])

    async def test_recent_chat_is_only_loaded_for_conversation_reference(self):
        self.db.chat_messages.documents = [{"_id": "chat-1", "role": "user", "content": "Earlier message"}]

        context = await self.engine.build_context("user-a", "As I said earlier, continue that task")

        self.assertEqual(len(context.recent_chat), 1)
        query, _ = self.db.chat_messages.find_calls[0]
        self.assertEqual(query["user_id"], "user-a")

    async def test_facade_exposes_read_only_context_interface(self):
        context = await IntelligenceEngine(self.db).build_context("user-a", "Show my tasks")

        self.assertEqual(context.request.message, "Show my tasks")
        self.assertTrue(context.tasks == [])


if __name__ == "__main__":
    unittest.main()
