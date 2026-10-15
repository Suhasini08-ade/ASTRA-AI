"""Schemas for persisted, user-owned focus sessions."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class FocusSessionStatus(str, Enum):
    COMPLETED = "completed"
    STOPPED = "stopped"


class FocusSessionCreate(BaseModel):
    task_id: str = Field(..., min_length=1)
    duration_seconds: int = Field(..., ge=0, le=24 * 60 * 60)
    status: FocusSessionStatus


class FocusSessionResponse(BaseModel):
    id: str
    user_id: str
    task_id: str
    task_title: str
    duration_seconds: int
    status: FocusSessionStatus
    timestamp: datetime
