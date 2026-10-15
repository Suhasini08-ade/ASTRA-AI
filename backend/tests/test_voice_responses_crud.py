"""
backend/tests/test_voice_responses_crud.py
===========================================
Comprehensive unit and integration tests verifying voice assistant confirmations
for Tasks, Reminders, Notes, and Calendar events.

Ensures:
- Every successful CRUD operation returns a short, natural confirmation based on actual result.
- Never speaks raw timestamps (e.g. 0000, 00:00:00, +00:00), ISO dates, JSON, ObjectIds, UUIDs, or technical data.
- Converts valid dates and times into human-readable speech and omits invalid/missing ones without inventing details.
- Responses are clean and ready for speech synthesis.
"""

from datetime import datetime, timedelta, timezone
import re
import unittest
from fastapi.testclient import TestClient

from backend.database import get_database
from backend.main import app
from backend.services.agent_tools import (
    _format_human_datetime,
    execute_agent_tool,
)
from backend.services.ai_service import AIService


class TestVoiceResponsesCrud(unittest.IsolatedAsyncioTestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        timestamp = int(datetime.now().timestamp() * 1000)
        reg = cls.client.post("/api/auth/register", json={
            "name": "CRUD Voice User",
            "email": f"voice_crud_{timestamp}@astra.ai",
            "password": "Password123!"
        })
        cls.token = reg.json()["data"]["token"]
        cls.user_id = reg.json()["data"]["user"]["id"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    async def asyncSetUp(self):
        self.db = get_database()

    def _assert_clean_spoken_text(self, text: str):
        """Assert that text contains no technical artifacts, raw timestamps, ISO dates, ObjectIds, or JSON."""
        self.assertTrue(isinstance(text, str), f"Expected string, got {type(text)}")
        self.assertTrue(len(text) > 0, "Spoken text should not be empty")

        # No raw ISO dates (e.g., 2026-10-17T09:00:00)
        self.assertFalse(
            bool(re.search(r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", text)),
            f"Found raw ISO date in speech: '{text}'"
        )
        # No timezone offsets like +00:00 or -05:00
        self.assertFalse(
            bool(re.search(r"[+-]\d{2}:\d{2}\b", text)),
            f"Found raw timezone offset in speech: '{text}'"
        )
        # No raw timestamps like 0000 or 00:00:00
        self.assertFalse(
            bool(re.search(r"\b0000\b", text)),
            f"Found '0000' in speech: '{text}'"
        )
        self.assertFalse(
            bool(re.search(r"\b00:00(?::00)?\b", text)),
            f"Found midnight timestamp in speech: '{text}'"
        )
        # No raw 24-character hex ObjectIds
        self.assertFalse(
            bool(re.search(r"\b[0-9a-fA-F]{24}\b", text)),
            f"Found raw ObjectId in speech: '{text}'"
        )
        # No JSON braces
        self.assertFalse("{" in text or "}" in text, f"Found JSON braces in speech: '{text}'")

    # -------------------------------------------------------------------------
    # 1. Human Datetime Formatter Unit Tests
    # -------------------------------------------------------------------------
    def test_human_datetime_formatting(self):
        now = datetime.now(timezone.utc)
        
        # Today with time
        today_5pm = now.replace(hour=17, minute=0, second=0, microsecond=0)
        h_today = _format_human_datetime(today_5pm)
        self.assertIn("today", h_today.lower())
        self.assertIn("5 PM", h_today)
        self._assert_clean_spoken_text(h_today)

        # Tomorrow with specific minutes
        tomorrow_930am = (now + timedelta(days=1)).replace(hour=9, minute=30, second=0, microsecond=0)
        h_tomorrow = _format_human_datetime(tomorrow_930am)
        self.assertIn("tomorrow", h_tomorrow.lower())
        self.assertIn("9:30 AM", h_tomorrow)
        self._assert_clean_spoken_text(h_tomorrow)

        # Date without specific time (midnight 00:00:00) should omit time completely
        tomorrow_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        h_midnight = _format_human_datetime(tomorrow_midnight)
        self.assertEqual(h_midnight, "tomorrow")
        self.assertNotIn("00:00", h_midnight)
        self.assertNotIn("12 AM", h_midnight)

        # Invalid or missing
        self.assertIsNone(_format_human_datetime(None))
        self.assertIsNone(_format_human_datetime(""))
        self.assertIsNone(_format_human_datetime("not-a-date"))

    # -------------------------------------------------------------------------
    # 2. _strip_voice_markdown Unit Tests
    # -------------------------------------------------------------------------
    def test_strip_voice_markdown_sanitization(self):
        dirty_input = (
            "Task `507f1f77bcf86cd799439011` created for 2026-10-17T09:00:00+00:00 with "
            '{"status": "success", "id": "507f1f77bcf86cd799439011"} at 0000.'
        )
        cleaned = AIService._strip_voice_markdown(dirty_input)
        self._assert_clean_spoken_text(cleaned)
        self.assertNotIn("507f1f77bcf86cd799439011", cleaned)
        self.assertNotIn("+00:00", cleaned)
        self.assertNotIn("0000", cleaned)
        self.assertNotIn("{", cleaned)

    # -------------------------------------------------------------------------
    # 3. Tasks CRUD Tool Handlers Tests
    # -------------------------------------------------------------------------
    async def test_tasks_crud_voice_responses(self):
        # CREATE
        tomorrow_iso = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=18, minute=0).isoformat()
        create_res = await execute_agent_tool(
            "create_task",
            {"title": "Prepare presentation", "due_date": tomorrow_iso, "priority": "high"},
            self.db,
            self.user_id,
        )
        self.assertEqual(create_res["status"], "success")
        msg = create_res["message"]
        self._assert_clean_spoken_text(msg)
        self.assertIn("Prepare presentation", msg)
        self.assertIn("tomorrow", msg.lower())

        # VIEW
        view_res = await execute_agent_tool("view_tasks", {}, self.db, self.user_id)
        self.assertEqual(view_res["status"], "success")
        self._assert_clean_spoken_text(view_res["message"])
        self.assertIn("task", view_res["message"].lower())

        # UPDATE (mark completed)
        update_res = await execute_agent_tool(
            "update_task",
            {"title": "Prepare presentation", "status": "done"},
            self.db,
            self.user_id,
        )
        self.assertEqual(update_res["status"], "success")
        self._assert_clean_spoken_text(update_res["message"])
        self.assertIn("completed", update_res["message"].lower())

        # DELETE
        delete_res = await execute_agent_tool(
            "delete_task",
            {"title": "Prepare presentation"},
            self.db,
            self.user_id,
        )
        self.assertEqual(delete_res["status"], "success")
        self._assert_clean_spoken_text(delete_res["message"])
        self.assertIn("deleted successfully", delete_res["message"].lower())

    # -------------------------------------------------------------------------
    # 4. Notes CRUD Tool Handlers Tests
    # -------------------------------------------------------------------------
    async def test_notes_crud_voice_responses(self):
        # CREATE
        create_res = await execute_agent_tool(
            "create_note",
            {"title": "Meeting Minutes", "content": "Discussed Q4 voice assistant roadmap."},
            self.db,
            self.user_id,
        )
        self.assertEqual(create_res["status"], "success")
        self._assert_clean_spoken_text(create_res["message"])
        self.assertIn("Meeting Minutes", create_res["message"])

        # VIEW
        view_res = await execute_agent_tool("view_notes", {}, self.db, self.user_id)
        self.assertEqual(view_res["status"], "success")
        self._assert_clean_spoken_text(view_res["message"])
        self.assertIn("note", view_res["message"].lower())

        # UPDATE
        update_res = await execute_agent_tool(
            "update_note",
            {"title": "Meeting Minutes", "new_title": "Updated Meeting Minutes"},
            self.db,
            self.user_id,
        )
        self.assertEqual(update_res["status"], "success")
        self._assert_clean_spoken_text(update_res["message"])
        self.assertIn("Updated Meeting Minutes", update_res["message"])

        # DELETE
        delete_res = await execute_agent_tool(
            "delete_note",
            {"title": "Updated Meeting Minutes"},
            self.db,
            self.user_id,
        )
        self.assertEqual(delete_res["status"], "success")
        self._assert_clean_spoken_text(delete_res["message"])
        self.assertIn("deleted successfully", delete_res["message"].lower())

    # -------------------------------------------------------------------------
    # 5. Reminders CRUD Tool Handlers Tests
    # -------------------------------------------------------------------------
    async def test_reminders_crud_voice_responses(self):
        # CREATE
        due_iso = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=14, minute=0).isoformat()
        create_res = await execute_agent_tool(
            "create_reminder",
            {"message": "Drink water and stretch", "due_time": due_iso},
            self.db,
            self.user_id,
        )
        self.assertEqual(create_res["status"], "success")
        self._assert_clean_spoken_text(create_res["message"])
        self.assertIn("Drink water and stretch", create_res["message"])
        self.assertIn("2 PM", create_res["message"])

        # VIEW
        view_res = await execute_agent_tool("view_reminders", {}, self.db, self.user_id)
        self.assertEqual(view_res["status"], "success")
        self._assert_clean_spoken_text(view_res["message"])
        self.assertIn("reminder", view_res["message"].lower())

        # UPDATE
        update_res = await execute_agent_tool(
            "update_reminder",
            {"message": "Drink water and stretch", "is_active": False},
            self.db,
            self.user_id,
        )
        self.assertEqual(update_res["status"], "success")
        self._assert_clean_spoken_text(update_res["message"])
        self.assertIn("completed", update_res["message"].lower())

        # DELETE
        delete_res = await execute_agent_tool(
            "delete_reminder",
            {"message": "Drink water and stretch"},
            self.db,
            self.user_id,
        )
        self.assertEqual(delete_res["status"], "success")
        self._assert_clean_spoken_text(delete_res["message"])
        self.assertIn("deleted successfully", delete_res["message"].lower())

    # -------------------------------------------------------------------------
    # 6. Calendar CRUD Tool Handlers Tests
    # -------------------------------------------------------------------------
    async def test_calendar_crud_voice_responses(self):
        # CREATE
        start_iso = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=11, minute=0).isoformat()
        create_res = await execute_agent_tool(
            "create_calendar_event",
            {"title": "Team Sync", "start_time": start_iso, "description": "Weekly status review"},
            self.db,
            self.user_id,
        )
        self.assertEqual(create_res["status"], "success")
        self._assert_clean_spoken_text(create_res["message"])
        self.assertIn("Team Sync", create_res["message"])
        self.assertIn("11 AM", create_res["message"])

        # VIEW
        view_res = await execute_agent_tool("view_calendar_events", {}, self.db, self.user_id)
        self.assertEqual(view_res["status"], "success")
        self._assert_clean_spoken_text(view_res["message"])
        self.assertIn("calendar event", view_res["message"].lower())

        # UPDATE
        resched_iso = (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=15, minute=0).isoformat()
        update_res = await execute_agent_tool(
            "update_calendar_event",
            {"title": "Team Sync", "start_time": resched_iso},
            self.db,
            self.user_id,
        )
        self.assertEqual(update_res["status"], "success")
        self._assert_clean_spoken_text(update_res["message"])
        self.assertIn("3 PM", update_res["message"])

        # DELETE
        delete_res = await execute_agent_tool(
            "delete_calendar_event",
            {"title": "Team Sync"},
            self.db,
            self.user_id,
        )
        self.assertEqual(delete_res["status"], "success")
        self._assert_clean_spoken_text(delete_res["message"])
        self.assertIn("deleted successfully", delete_res["message"].lower())

    # -------------------------------------------------------------------------
    # 7. End-to-End Voice Command API Endpoint Tests
    # -------------------------------------------------------------------------
    def test_voice_api_crud_task_creation(self):
        res = self.client.post("/api/voice/command", json={
            "command": "Create a task called Submit Lab Report due tomorrow at 5 PM."
        }, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        reply = res.json()["data"]["reply"]
        self._assert_clean_spoken_text(reply)
        self.assertTrue(
            any(k in reply.lower() for k in ["lab report", "task", "created"]),
            f"Unexpected reply: {reply}"
        )

    def test_voice_api_crud_reminder_creation(self):
        res = self.client.post("/api/voice/command", json={
            "command": "Remind me to call Mom tomorrow at 7 PM."
        }, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        reply = res.json()["data"]["reply"]
        self._assert_clean_spoken_text(reply)
        self.assertTrue(
            any(k in reply.lower() for k in ["mom", "reminder", "set", "call"]),
            f"Unexpected reply: {reply}"
        )


if __name__ == "__main__":
    unittest.main()
