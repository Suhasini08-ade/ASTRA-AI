"""
models/user.py
==============
Pydantic schemas for user registration, login, and responses.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user data in API responses."""
    id: str
    name: str
    email: str
    created_at: datetime


class GoogleAuthRequest(BaseModel):
    """Schema for Google OAuth authentication."""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    avatar_url: str | None = None
    uid: str | None = None


class TokenResponse(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

