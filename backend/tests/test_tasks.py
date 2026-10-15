"""
Unit and integration tests for Task models, status validation, and task operations.
Verifies create, update, complete ("done"), reopen ("todo"), and 422 rejection on "completed".
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from pydantic import ValidationError
from fastapi.testclient import TestClient

from backend.app import app
from backend.models.task import TaskCreate, TaskPriority, TaskResponse, TaskStatus, TaskUpdate
from backend.utils.auth import get_current_user
from backend.database import get_database


class TaskModelTests(unittest.TestCase):
    def test_task_status_enum_values(self):
        """TaskStatus should only allow todo, in_progress, and done."""
        valid_statuses = [status.value for status in TaskStatus]
        self.assertIn("todo", valid_statuses)
        self.assertIn("in_progress", valid_statuses)
        self.assertIn("done", valid_statuses)
        self.assertNotIn("completed", valid_statuses)

    def test_create_task_with_default_status(self):
        """Default status on creation should be TaskStatus.TODO."""
        task = TaskCreate(title="Test Task")
        self.assertEqual(task.status, TaskStatus.TODO)
        self.assertEqual(task.status.value, "todo")

    def test_create_task_with_valid_statuses(self):
        """Creating a task with 'todo', 'in_progress', or 'done' should succeed."""
        task_todo = TaskCreate(title="Task 1", status="todo")
        self.assertEqual(task_todo.status, TaskStatus.TODO)

        task_in_progress = TaskCreate(title="Task 2", status="in_progress")
        self.assertEqual(task_in_progress.status, TaskStatus.IN_PROGRESS)

        task_done = TaskCreate(title="Task 3", status="done")
        self.assertEqual(task_done.status, TaskStatus.DONE)

    def test_create_task_with_completed_status_fails(self):
        """Creating a task with status 'completed' must raise ValidationError (HTTP 422)."""
        with self.assertRaises(ValidationError) as ctx:
            TaskCreate(title="Task Invalid", status="completed")
        self.assertIn("status", str(ctx.exception))

    def test_update_task_complete_operation(self):
        """Completing a task using status 'done' must validate successfully."""
        update = TaskUpdate(status="done")
        self.assertEqual(update.status, TaskStatus.DONE)
        self.assertEqual(update.status.value, "done")

    def test_update_task_reopen_operation(self):
        """Reopening a task using status 'todo' must validate successfully."""
        update = TaskUpdate(status="todo")
        self.assertEqual(update.status, TaskStatus.TODO)
        self.assertEqual(update.status.value, "todo")

    def test_update_task_with_completed_status_fails(self):
        """Updating a task with status 'completed' must raise ValidationError (HTTP 422)."""
        with self.assertRaises(ValidationError) as ctx:
            TaskUpdate(status="completed")
        self.assertIn("status", str(ctx.exception))

    def test_task_response_serialization(self):
        """TaskResponse model correctly handles and serializes done status."""
        now = datetime.now(timezone.utc)
        res = TaskResponse(
            id="64f1234567890abcdef12345",
            user_id="user_123",
            title="Complete Report",
            description="All sections finished",
            due_date=None,
            priority=TaskPriority.HIGH,
            status=TaskStatus.DONE,
            created_at=now,
            updated_at=now,
        )
        data = res.model_dump()
        self.assertEqual(data["status"], TaskStatus.DONE)
        self.assertEqual(data["priority"], TaskPriority.HIGH)


class TaskEndpointIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.mock_user = {"_id": "test_user_123", "email": "test@example.com"}
        self.mock_db = MagicMock()
        self.mock_tasks_collection = MagicMock()
        self.mock_db.tasks = self.mock_tasks_collection

        app.dependency_overrides[get_current_user] = lambda: self.mock_user
        app.dependency_overrides[get_database] = lambda: self.mock_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_put_task_status_completed_returns_422(self):
        """Verifies that sending status 'completed' causes HTTP 422 Unprocessable Entity."""
        response = self.client.put(
            "/api/tasks/507f1f77bcf86cd799439011",
            json={"status": "completed"}
        )
        self.assertEqual(response.status_code, 422)
        errors = response.json().get("detail", [])
        self.assertTrue(any("status" in str(err) for err in errors))

    def test_put_task_status_done_is_accepted(self):
        """Verifies that sending status 'done' passes payload validation."""
        now = datetime.now(timezone.utc)
        self.mock_tasks_collection.find_one_and_update = AsyncMock(return_value={
            "_id": "507f1f77bcf86cd799439011",
            "user_id": "test_user_123",
            "title": "Existing Task",
            "description": "",
            "due_date": None,
            "priority": "medium",
            "status": "done",
            "created_at": now,
            "updated_at": now,
        })
        response = self.client.put(
            "/api/tasks/507f1f77bcf86cd799439011",
            json={"status": "done"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["status"], "done")

    def test_put_task_status_todo_reopens_task(self):
        """Verifies that sending status 'todo' reopens the task successfully."""
        now = datetime.now(timezone.utc)
        self.mock_tasks_collection.find_one_and_update = AsyncMock(return_value={
            "_id": "507f1f77bcf86cd799439011",
            "user_id": "test_user_123",
            "title": "Existing Task",
            "description": "",
            "due_date": None,
            "priority": "medium",
            "status": "todo",
            "created_at": now,
            "updated_at": now,
        })
        response = self.client.put(
            "/api/tasks/507f1f77bcf86cd799439011",
            json={"status": "todo"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["data"]["status"], "todo")

    def test_create_task_post_success(self):
        """Verifies creating a task via POST /api/tasks works with status 'todo'."""
        now = datetime.now(timezone.utc)
        insert_result = MagicMock()
        insert_result.inserted_id = "507f1f77bcf86cd799439011"
        self.mock_tasks_collection.insert_one = AsyncMock(return_value=insert_result)

        response = self.client.post(
            "/api/tasks",
            json={"title": "New Task", "priority": "high", "status": "todo"}
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["data"]["status"], "todo")
        self.assertEqual(data["data"]["priority"], "high")


if __name__ == "__main__":
    unittest.main()
