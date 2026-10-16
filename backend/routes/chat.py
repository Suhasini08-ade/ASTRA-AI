"""
routes/chat.py
==============
AI Chat endpoints: send messages, get history, clear history.
"""

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from backend.database import get_database
from backend.services.ai_service import ai_service
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

router = APIRouter(prefix="/api/chat", tags=["AI Chat"])


class ChatMessage(BaseModel):
    """Schema for sending a chat message, optionally with an attached document."""
    message: str = Field(..., min_length=1, max_length=5000)
    conversation_id: str | None = Field(default=None, max_length=100)
    document_id: str | None = Field(default=None, max_length=100)
    document_hash: str | None = Field(default=None, max_length=100)
    file_name: str | None = Field(default=None, max_length=255)


@router.post("")
async def send_message(
    body: ChatMessage,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Send a message to the AI assistant and get a response."""
    user_id = current_user["_id"]
    reply = await ai_service.send_message(
        db,
        user_id,
        body.message,
        conversation_id=body.conversation_id,
        document_id=body.document_id,
        document_hash=body.document_hash,
        file_name=body.file_name,
    )
    return success_response(
        data={"reply": reply},
        message="Message processed.",
    )


@router.get("/history")
async def get_chat_history(
    limit: int = 50,
    conversation_id: str | None = Query(default=None, max_length=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Retrieve the user's chat history."""
    user_id = current_user["_id"]
    messages = await ai_service.get_history(db, user_id, limit=limit, conversation_id=conversation_id)
    return success_response(data={"messages": messages})


@router.get("/conversations")
async def list_conversations(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Return one user-owned summary per persisted normal-chat conversation."""
    docs = await db.chat_messages.find(
        {"user_id": current_user["_id"]},
        {"conversation_id": 1, "role": 1, "content": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(length=1000)
    conversations: dict[str, dict] = {}
    for doc in docs:
        conversation_id = doc.get("conversation_id", "legacy")
        item = conversations.setdefault(conversation_id, {
            "id": conversation_id,
            "title": "Earlier conversation" if conversation_id == "legacy" else "New conversation",
            "updated_at": doc.get("created_at"),
            "message_count": 0,
        })
        item["message_count"] += 1
        if doc.get("role") == "user" and item["title"] in {"New conversation", "Earlier conversation"}:
            item["title"] = str(doc.get("content", "New conversation"))[:80]
    result = sorted(
        conversations.values(),
        key=lambda item: item.get("updated_at").timestamp() if item.get("updated_at") else 0,
        reverse=True,
    )
    return success_response(data=result[:50])


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
