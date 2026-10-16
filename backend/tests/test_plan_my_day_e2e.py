"""
backend/tests/test_plan_my_day_e2e.py
======================================
End-to-end integration tests verifying ASTRA AI's "Plan My Day" voice command
with real authenticated user data from MongoDB (tasks, calendar events,
reminders, notes, deadlines, priorities, and conflict detection).

Validates:
- Real database data retrieval for the authenticated user using official REST APIs.
- High-priority and urgent deadline classification.
- Pairwise calendar conflict detection.
- Time-blocked realistic schedule generation with breaks.
- Full markdown formatting for UI display.
- Clean, concise spoken summary for speech synthesis without raw timestamps or technical syntax.
- Natural language command variations ("plan my day", "organize my day", "daily schedule").
"""

from datetime import datetime, timedelta, timezone
import re
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.daily_planner import is_plan_my_day_command


class TestPlanMyDayE2E(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        timestamp = int(datetime.now().timestamp() * 1000)
        # Register a fresh authenticated test user
        reg_res = cls.client.post(
            "/api/auth/register",
            json={
                "name": "Planner Real User",
                "email": f"planner_real_{timestamp}@astra.ai",
                "password": "Password123!",
            },
        )
        assert reg_res.status_code in (200, 201), f"Registration failed: {reg_res.text}"
        data = reg_res.json()["data"]
        cls.token = data["token"]
        cls.user_id = data["user"]["id"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def _assert_clean_spoken_summary(self, text: str):
        """Assert spoken summary is natural, readable, and free of markdown and raw tech tokens."""
        self.assertTrue(isinstance(text, str), "Spoken summary must be a string")
        self.assertTrue(len(text) > 20, f"Spoken summary is too short: '{text}'")

        # No markdown headers, bold, bullets, or backticks
        self.assertNotIn("#", text, "Spoken summary should not contain markdown '#' headers")
        self.assertNotIn("`", text, "Spoken summary should not contain code backticks")
        self.assertNotIn("**", text, "Spoken summary should not contain markdown bold syntax")

        # No raw ISO dates (e.g. 2026-10-16T10:00:00)
        self.assertFalse(
            bool(re.search(r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", text)),
            f"Found raw ISO datetime in speech: {text}",
        )
        # No 24-char ObjectId strings
        self.assertFalse(
            bool(re.search(r"\b[0-9a-fA-F]{24}\b", text)),
            f"Found raw MongoDB ObjectId in speech: {text}",
        )

    def test_command_intent_matching(self):
        """Verify command pattern recognition for various user phrasings."""
        self.assertTrue(is_plan_my_day_command("Plan my day"))
        self.assertTrue(is_plan_my_day_command("can you please plan my day"))
        self.assertTrue(is_plan_my_day_command("daily schedule"))
        self.assertTrue(is_plan_my_day_command("organize my day"))
        self.assertTrue(is_plan_my_day_command("what should I work on today"))
        self.assertTrue(is_plan_my_day_command("create a daily plan"))
        self.assertTrue(is_plan_my_day_command("help me plan today"))

        # Should not match unrelated queries
        self.assertFalse(is_plan_my_day_command("what is the weather"))
        self.assertFalse(is_plan_my_day_command("create a task called buy groceries"))
        self.assertFalse(is_plan_my_day_command("hello there"))

    def test_plan_my_day_with_real_user_data_and_conflicts(self):
        """Seed real tasks, calendar events (with conflict), reminders, and notes via APIs, and call /api/voice/command."""
        now = datetime.now(timezone.utc)
        today_date_str = now.strftime("%Y-%m-%d")

        # 1. Create real tasks via authenticated API
        task1_res = self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={
                "title": "Finalize Q4 Financial Report",
                "description": "Prepare balance sheet and review revenue targets",
                "priority": "high",
                "status": "todo",
                "due_date": f"{today_date_str}T17:00:00Z",
            },
        )
        self.assertEqual(task1_res.status_code, 201, f"Task 1 failed: {task1_res.text}")

        task2_res = self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={
                "title": "Refactor Navigation Component",
                "description": "Clean up unused props and add accessibility tags",
                "priority": "medium",
                "status": "in_progress",
            },
        )
        self.assertEqual(task2_res.status_code, 201, f"Task 2 failed: {task2_res.text}")

        # Completed task to ensure it's filtered out from active schedule
        task3_res = self.client.post(
            "/api/tasks",
            headers=self.headers,
            json={
                "title": "Archive Old Invoices",
                "description": "Already completed task from last week",
                "priority": "low",
                "status": "done",
            },
        )
        self.assertEqual(task3_res.status_code, 201, f"Task 3 failed: {task3_res.text}")

        # 2. Create real calendar events with deliberate overlap/conflict
        # Event A: 10:00 AM - 11:30 AM
        event1_res = self.client.post(
            "/api/calendar/events",
            headers=self.headers,
            json={
                "title": "Executive Strategy Sync",
                "description": "Quarterly leadership roadmap alignment",
                "start_time": f"{today_date_str}T10:00:00Z",
                "end_time": f"{today_date_str}T11:30:00Z",
                "color": "#4f46e5",
            },
        )
        self.assertIn(event1_res.status_code, (200, 201), f"Event 1 failed: {event1_res.text}")

        # Event B: 11:00 AM - 12:00 PM (overlaps with Event A from 11:00 to 11:30!)
        event2_res = self.client.post(
            "/api/calendar/events",
            headers=self.headers,
            json={
                "title": "Emergency Architecture Review",
                "description": "Review database migration bottleneck",
                "start_time": f"{today_date_str}T11:00:00Z",
                "end_time": f"{today_date_str}T12:00:00Z",
                "color": "#ef4444",
            },
        )
        self.assertIn(event2_res.status_code, (200, 201), f"Event 2 failed: {event2_res.text}")

        # Event C: 02:00 PM - 03:00 PM
        event3_res = self.client.post(
            "/api/calendar/events",
            headers=self.headers,
            json={
                "title": "Client Onboarding Demo",
                "description": "Walk new client through ASTRA features",
                "start_time": f"{today_date_str}T14:00:00Z",
                "end_time": f"{today_date_str}T15:00:00Z",
                "color": "#10b981",
            },
        )
        self.assertIn(event3_res.status_code, (200, 201), f"Event 3 failed: {event3_res.text}")

        # 3. Create real reminders
        rem1_res = self.client.post(
            "/api/reminders",
            headers=self.headers,
            json={
                "message": "Submit weekly sprint retrospectives",
                "due_time": f"{today_date_str}T16:30:00Z",
            },
        )
        self.assertEqual(rem1_res.status_code, 201, f"Reminder 1 failed: {rem1_res.text}")

        rem2_res = self.client.post(
            "/api/reminders",
            headers=self.headers,
            json={
                "message": "Hydrate and stretch break",
                "due_time": f"{today_date_str}T14:30:00Z",
            },
        )
        self.assertEqual(rem2_res.status_code, 201, f"Reminder 2 failed: {rem2_res.text}")

        # 4. Create real notes
        note_res = self.client.post(
            "/api/notes",
            headers=self.headers,
            json={
                "title": "Architecture Principles",
                "content": "Ensure zero-downtime deployments and idempotent database migrations.",
                "tags": ["architecture", "standards"],
            },
        )
        self.assertEqual(note_res.status_code, 201, f"Note failed: {note_res.text}")

        # 5. Send voice command "Plan my day"
        response = self.client.post(
            "/api/voice/command",
            headers=self.headers,
            json={"command": "Plan my day"},
        )

        self.assertEqual(response.status_code, 200, f"Error: {response.text}")
        json_data = response.json()
        self.assertEqual(json_data.get("status"), "success", "API returned failure")
        payload = json_data.get("data")
        self.assertIsInstance(payload, dict)

        full_reply = payload.get("reply")
        spoken_summary = payload.get("spoken_summary")

        # Verify UI Markdown content
        self.assertIn("Personalized Daily Plan", full_reply)
        self.assertIn("Finalize Q4 Financial Report", full_reply)
        self.assertIn("[HIGH]", full_reply)
        self.assertIn("Refactor Navigation Component", full_reply)
        # Completed task must NOT appear in pending/urgent list
        self.assertNotIn("Archive Old Invoices", full_reply)

        # Verify Calendar & Scheduling Conflict Detection
        self.assertIn("Executive Strategy Sync", full_reply)
        self.assertIn("Emergency Architecture Review", full_reply)
        self.assertIn("Scheduling Conflict Detected", full_reply)
        self.assertIn("Overlap between", full_reply)

        # Verify Time-Blocked Schedule and Breaks
        self.assertIn("Lunch", full_reply)
        self.assertIn("Break", full_reply)
        self.assertIn("Wrap-Up", full_reply)

        # Verify Reminders & Notes inclusion
        self.assertIn("Submit weekly sprint retrospectives", full_reply)
        self.assertIn("Architecture Principles", full_reply)

        # Verify Spoken Summary Quality
        self._assert_clean_spoken_summary(spoken_summary)
        self.assertIn("Finalize Q4 Financial Report", spoken_summary)
        self.assertIn("conflict", spoken_summary.lower())

    def test_plan_my_day_empty_state(self):
        """Verify graceful, actionable schedule generation when user has no existing tasks/events."""
        # Create a brand new user with no tasks or events
        timestamp = int(datetime.now().timestamp() * 1000) + 999
        reg_res = self.client.post(
            "/api/auth/register",
            json={
                "name": "Empty User",
                "email": f"empty_user_{timestamp}@astra.ai",
                "password": "Password123!",
            },
        )
        token = reg_res.json()["data"]["token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = self.client.post(
            "/api/voice/command",
            headers=headers,
            json={"command": "Organize my day"},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        full_reply = payload["reply"]
        spoken_summary = payload["spoken_summary"]

        self.assertIn("Personalized Daily Plan", full_reply)
        self.assertIn("No overdue or high-priority tasks pending", full_reply)
        self.assertIn("Calendar is clear today", full_reply)
        self.assertIn("Lunch", full_reply)

        self._assert_clean_spoken_summary(spoken_summary)
        self.assertIn("0 calendar events", spoken_summary.lower())
        self.assertIn("0 pending tasks", spoken_summary.lower())


if __name__ == "__main__":
    unittest.main()
