"""
routes/agent.py
===============
AI Agent endpoint for processing natural-language user requests.
POST /api/agent/chat
"""

import logging

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from backend.database import get_database
from backend.services.ai_service import ai_service
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agent", tags=["AI Agent"])


class AgentChatRequest(BaseModel):
    """Schema for sending a chat message to the AI Agent."""

    message: str = Field(..., min_length=1, max_length=5000)
    conversation_id: str | None = Field(default=None, max_length=100)


@router.post("/chat")
async def agent_chat(
    body: AgentChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    POST /api/agent/chat
    Receive user message, process through AI Agent (Tools -> DB/APIs), and return response.
    """
    user_id = current_user["_id"]
    logger.info("[AGENT CHAT ENDPOINT] Received authenticated chat request")

    reply = await ai_service.send_message(db, user_id, body.message, conversation_id=body.conversation_id)

    return success_response(
        data={"reply": reply},
        message="Message processed by AI Agent.",
    )
