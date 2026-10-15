"""
models/reminder.py
==================
Pydantic schemas for reminders CRUD operations.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class ReminderCreate(BaseModel):
    """Schema for creating a new reminder."""
    message: str = Field(..., min_length=1, max_length=500)
    due_time: datetime
    repeat: str | None = Field(default=None, description="Repeat pattern: daily, weekly, monthly, or null")


class ReminderUpdate(BaseModel):
    """Schema for updating an existing reminder. All fields optional."""
    message: str | None = Field(default=None, max_length=500)
    due_time: datetime | None = None
    repeat: str | None = None
    is_active: bool | None = None


class ReminderResponse(BaseModel):
    """Schema for reminder data in API responses."""
    id: str
    user_id: str
    message: str
    due_time: datetime
    repeat: str | None
    is_active: bool
    created_at: datetime
