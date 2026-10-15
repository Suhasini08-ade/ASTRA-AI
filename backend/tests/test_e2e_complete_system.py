"""
test_e2e_complete_system.py
===========================
End-to-end integration and verification suite testing:
1. Authentication (Registration, Login, GetMe, Profile update, Settings persistence)
2. User Data Isolation (User A cannot access User B's private data)
3. Productivity Features (Tasks, Notes, Reminders, Calendar CRUD)
4. Weather and News real API retrieval
5. AI Agent & Voice Assistant Command Dispatch (Task creation, completion, weather)
6. Desktop Application Launching (Notepad, Calculator, Chrome, VS Code, Browser URL, Folders)
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.desktop import AppLauncher, BrowserLauncher, FolderLauncher, DesktopService


class CompleteSystemE2ETests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_auth_and_user_isolation(self):
        """Verify registration, login, profile, settings, and user data isolation."""
        timestamp = int(datetime.now().timestamp() * 1000)
        email_a = f"testuser_a_{timestamp}@astra.ai"
        email_b = f"testuser_b_{timestamp}@astra.ai"
        password = "SecurePassword123!"

        # 1. Register User A
        res_a = self.client.post("/api/auth/register", json={
            "name": "User Alpha",
            "email": email_a,
            "password": password
        })
        self.assertEqual(res_a.status_code, 201, res_a.text)
        data_a = res_a.json()["data"]
        token_a = data_a["token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. Register User B
        res_b = self.client.post("/api/auth/register", json={
            "name": "User Beta",
            "email": email_b,
            "password": password
        })
        self.assertEqual(res_b.status_code, 201, res_b.text)
        token_b = res_b.json()["data"]["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 3. Test /api/auth/me for User A
        me_a = self.client.get("/api/auth/me", headers=headers_a)
        self.assertEqual(me_a.status_code, 200)
        self.assertEqual(me_a.json()["data"]["email"], email_a)

        # 4. Update Profile for User A
        prof_update = self.client.put("/api/auth/profile", json={"bio": "Senior AI Engineer"}, headers=headers_a)
        self.assertEqual(prof_update.status_code, 200)
        self.assertEqual(prof_update.json()["data"]["bio"], "Senior AI Engineer")

        # 5. Persist Settings for User A
        set_update = self.client.put("/api/auth/settings", json={"theme": "dark", "voiceSpeed": "1.2"}, headers=headers_a)
        self.assertEqual(set_update.status_code, 200)
        get_settings = self.client.get("/api/auth/settings", headers=headers_a)
        self.assertEqual(get_settings.status_code, 200)
        self.assertEqual(get_settings.json()["data"]["voiceSpeed"], "1.2")

        # 6. User A creates a task
        create_task_a = self.client.post("/api/tasks", json={
            "title": "Alpha Private Task",
            "description": "Sensitive Project Notes",
            "priority": "high",
            "status": "todo"
        }, headers=headers_a)
        self.assertEqual(create_task_a.status_code, 201)
        task_a_id = create_task_a.json()["data"]["id"]

        # 7. User B tries to view tasks: MUST NOT see User A's task
        tasks_b = self.client.get("/api/tasks", headers=headers_b)
        self.assertEqual(tasks_b.status_code, 200)
        b_task_ids = [t["id"] for t in tasks_b.json()["data"]]
        self.assertNotIn(task_a_id, b_task_ids)

        # 8. User B tries to delete User A's task: MUST return 404
        del_res = self.client.delete(f"/api/tasks/{task_a_id}", headers=headers_b)
        self.assertIn(del_res.status_code, {404, 403})

    def test_02_productivity_crud(self):
        """Verify Tasks, Notes, Reminders, and Calendar events CRUD."""
        timestamp = int(datetime.now().timestamp() * 1000)
        email = f"crud_user_{timestamp}@astra.ai"
        password = "TestPassword123!"

        reg = self.client.post("/api/auth/register", json={
            "name": "CRUD User",
            "email": email,
            "password": password
        })
        token = reg.json()["data"]["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Task CRUD
        t_res = self.client.post("/api/tasks", json={"title": "Finish DBMS Assignment", "priority": "high"}, headers=headers)
        self.assertEqual(t_res.status_code, 201)
        t_id = t_res.json()["data"]["id"]

        t_up = self.client.put(f"/api/tasks/{t_id}", json={"status": "done"}, headers=headers)
        self.assertEqual(t_up.status_code, 200)
        self.assertEqual(t_up.json()["data"]["status"], "done")

        t_del = self.client.delete(f"/api/tasks/{t_id}", headers=headers)
        self.assertEqual(t_del.status_code, 200)

        # 2. Note CRUD
        n_res = self.client.post("/api/notes", json={"title": "DBMS Notes", "content": "Relational algebra"}, headers=headers)
        self.assertEqual(n_res.status_code, 201)
        n_id = n_res.json()["data"]["id"]

        n_del = self.client.delete(f"/api/notes/{n_id}", headers=headers)
        self.assertEqual(n_del.status_code, 200)

        # 3. Reminder CRUD
        r_res = self.client.post("/api/reminders", json={"message": "Review DBMS", "due_time": "2026-10-17T09:00:00Z"}, headers=headers)
        self.assertEqual(r_res.status_code, 201)
        r_id = r_res.json()["data"]["id"]

        r_del = self.client.delete(f"/api/reminders/{r_id}", headers=headers)
        self.assertEqual(r_del.status_code, 200)

        # 4. Calendar CRUD
        c_res = self.client.post("/api/calendar/events", json={
            "title": "DBMS Viva",
            "start_time": "2026-10-18T10:00:00Z",
            "end_time": "2026-10-18T11:00:00Z"
        }, headers=headers)
        self.assertEqual(c_res.status_code, 201)
        c_id = c_res.json()["data"]["id"]

        c_del = self.client.delete(f"/api/calendar/events/{c_id}", headers=headers)
        self.assertEqual(c_del.status_code, 200)

    def test_03_weather_and_news_endpoints(self):
        """Verify Weather and News API endpoints return valid structured data."""
        # Weather
        w_res = self.client.get("/api/weather?location=Kolhapur")
        self.assertEqual(w_res.status_code, 200)
        w_data = w_res.json()
        self.assertIn("current", w_data)
        self.assertTrue("temperature" in w_data["current"] or "temp" in w_data["current"])

        # News
        news_res = self.client.get("/api/news?category=Technology")
        self.assertEqual(news_res.status_code, 200)
        n_data = news_res.json()
        self.assertIn("articles", n_data)
        self.assertTrue(len(n_data["articles"]) > 0)

    def test_04_voice_command_operations(self):
        """Verify Voice commands execute real backend actions and persist changes."""
        timestamp = int(datetime.now().timestamp() * 1000)
        email = f"voice_user_{timestamp}@astra.ai"
        reg = self.client.post("/api/auth/register", json={
            "name": "Voice User",
            "email": email,
            "password": "Password123!"
        })
        token = reg.json()["data"]["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Voice command: Create task
        cmd1 = self.client.post("/api/voice/command", json={
            "command": "Create a task to finish my DBMS assignment tomorrow at 6 PM."
        }, headers=headers)
        self.assertEqual(cmd1.status_code, 200)
        reply1 = cmd1.json()["data"]["reply"]
        self.assertTrue(
            any(k in reply1.lower() for k in ["dbms", "task", "created", "assignment"]),
            f"Unexpected reply1: {reply1}"
        )

        # Verify task exists in database
        tasks = self.client.get("/api/tasks", headers=headers)
        self.assertTrue(
            any("dbms" in t["title"].lower() for t in tasks.json()["data"]),
            f"Tasks in db: {tasks.json()['data']}"
        )

        # Voice command: Mark task as completed
        cmd2 = self.client.post("/api/voice/command", json={
            "command": "Mark my DBMS assignment as completed."
        }, headers=headers)
        self.assertEqual(cmd2.status_code, 200)

        # Voice command: Weather in Kolhapur
        cmd3 = self.client.post("/api/voice/command", json={
            "command": "What is the weather in Kolhapur?"
        }, headers=headers)
        self.assertEqual(cmd3.status_code, 200)
        reply3 = cmd3.json()["data"]["reply"]
        self.assertTrue(len(reply3) > 10)

    def test_05_desktop_control_supported_applications(self):
        """Verify safe launch mappings for all approved applications."""
        launcher = AppLauncher(process_spawner=lambda args: MagicMock(pid=12345))
        service = DesktopService(app_launcher=launcher)

        apps_to_test = ["notepad", "calculator", "chrome", "vscode"]
        for app_name in apps_to_test:
            res = service.open_app(app_name)
            self.assertTrue(res.get("success"), f"Launch failed for {app_name}: {res}")

        # Browser URL validation
        browser_launcher = BrowserLauncher(browser_opener=lambda url: True)
        service_browser = DesktopService(browser_launcher=browser_launcher)
        b_res = service_browser.open_website("https://youtube.com")
        self.assertTrue(b_res.get("success"))

        # Folder launcher
        folder_launcher = FolderLauncher(folder_opener=lambda p: True)
        service_folder = DesktopService(folder_launcher=folder_launcher)
        f_res = service_folder.open_folder("Downloads")
        self.assertTrue(f_res.get("success"))


if __name__ == "__main__":
    unittest.main()
