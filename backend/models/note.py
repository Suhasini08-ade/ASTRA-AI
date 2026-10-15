"""
models/note.py
==============
Pydantic schemas for notes CRUD operations.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    """Schema for creating a new note."""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(default="")
    tags: list[str] = Field(default_factory=list)


class NoteUpdate(BaseModel):
    """Schema for updating an existing note. All fields optional."""
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None
    tags: list[str] | None = None


class NoteResponse(BaseModel):
    """Schema for note data in API responses."""
    id: str
    user_id: str
    title: str
    content: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime
