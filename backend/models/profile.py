"""
models/profile.py
=================
Pydantic schemas for user profile management.
"""

from datetime import datetime
from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    """Schema for updating the user profile. All fields optional."""
    name: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = None
    bio: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=20)
    location: str | None = Field(default=None, max_length=100)


class ProfileResponse(BaseModel):
    """Schema for profile data in API responses."""
    id: str
    user_id: str
    name: str
    email: str
    avatar_url: str | None
    bio: str | None
    phone: str | None
    location: str | None
    updated_at: datetime
