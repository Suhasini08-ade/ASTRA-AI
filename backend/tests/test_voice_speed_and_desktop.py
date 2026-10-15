import unittest
import time
from datetime import datetime
from fastapi.testclient import TestClient

from backend.main import app


class VoiceSpeedAndDesktopTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        timestamp = int(datetime.now().timestamp() * 1000)
        reg = cls.client.post("/api/auth/register", json={
            "name": "Speed User",
            "email": f"speed_user_{timestamp}@astra.ai",
            "password": "Password123!"
        })
        cls.token = reg.json()["data"]["token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_01_desktop_app_opening_instant(self):
        """Verify 'open Chrome' and 'open Notepad' respond immediately without remote LLM failure."""
        t0 = time.time()
        res = self.client.post("/api/voice/command", json={
            "command": "open Notepad"
        }, headers=self.headers)
        duration = time.time() - t0
        self.assertEqual(res.status_code, 200)
        reply = res.json()["data"]["reply"]
        print(f"\nNotepad reply: '{reply}' in {duration:.3f}s")
        self.assertTrue("notepad" in reply.lower() or "launched" in reply.lower() or "opened" in reply.lower())
        self.assertLess(duration, 5.0, "Desktop command took too long!")

    def test_02_open_chrome_instant(self):
        """Verify 'open Chrome' responds immediately."""
        t0 = time.time()
        res = self.client.post("/api/voice/command", json={
            "command": "open Chrome"
        }, headers=self.headers)
        duration = time.time() - t0
        self.assertEqual(res.status_code, 200)
        reply = res.json()["data"]["reply"]
        print(f"\nChrome reply: '{reply}' in {duration:.3f}s")
        self.assertTrue("chrome" in reply.lower() or "launched" in reply.lower() or "opened" in reply.lower())
        self.assertLess(duration, 5.0, "Chrome launch took too long!")

    def test_03_task_creation_instant_voice_response(self):
        """Verify task creation via voice creates the task and returns voice confirmation quickly."""
        t0 = time.time()
        res = self.client.post("/api/voice/command", json={
            "command": "Create a task to finish my DBMS assignment tomorrow at 6 PM."
        }, headers=self.headers)
        duration = time.time() - t0
        self.assertEqual(res.status_code, 200)
        reply = res.json()["data"]["reply"]
        print(f"\nTask creation reply: '{reply}' in {duration:.3f}s")
        self.assertTrue(
            any(k in reply.lower() for k in ["dbms", "task", "created", "assignment"]),
            f"Unexpected reply: {reply}"
        )
        # Verify task is in DB
        tasks_res = self.client.get("/api/tasks", headers=self.headers)
        tasks = tasks_res.json()["data"]
        self.assertTrue(any("dbms" in t["title"].lower() for t in tasks))


if __name__ == "__main__":
    unittest.main()
