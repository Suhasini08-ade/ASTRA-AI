"""
routes/chat.py
==============
AI Chat endpoints: send messages, get history, clear history.
"""

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from backend.database import get_database
from backend.services.ai_service import ai_service
from backend.utils.auth import get_current_user, optional_get_current_user
from backend.utils.response import success_response

router = APIRouter(prefix="/api/chat", tags=["AI Chat"])


class ChatMessage(BaseModel):
    """Schema for sending a chat message."""
    message: str = Field(..., min_length=1, max_length=2000)


@router.post("")
async def send_message(
    body: ChatMessage,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a message to the AI assistant and get a response."""
    user_id = current_user["_id"]
    reply = await ai_service.send_message(db, user_id, body.message)
    return success_response(
        data={"reply": reply},
        message="Message processed.",
    )


@router.get("/history")
async def get_chat_history(
    limit: int = 50,
    current_user: dict | None = Depends(optional_get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Retrieve the user's chat history."""
    if not current_user:
        return success_response(data={"messages": []})
    user_id = current_user["_id"]
    messages = await ai_service.get_history(db, user_id, limit=limit)
    return success_response(data={"messages": messages})


@router.delete("/history")
async def clear_chat_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Clear all chat history for the current user."""
    user_id = current_user["_id"]
    deleted_count = await ai_service.clear_history(db, user_id)
    return success_response(
        message=f"Cleared {deleted_count} messages.",
    )
