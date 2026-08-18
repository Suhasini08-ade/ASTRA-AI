"""
services/ai_service.py
======================
AI Agent service utilizing pluggable AI Provider architecture (Gemini / OpenAI).
"""

from datetime import datetime, timezone
import json
import logging
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from backend.providers import (
    AIProviderConfigurationError,
    AIProviderError,
    AIProviderRequestError,
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
    get_ai_provider,
)
from backend.services.agent_tools import AGENT_TOOLS, execute_agent_tool

logger = logging.getLogger(__name__)

MAX_CONTEXT_MESSAGES = 20


class AIService:
    """Handles AI chat interactions via pluggable AI Provider architecture."""

    def __init__(self, provider: BaseAIProvider | None = None) -> None:
        self._provider: BaseAIProvider = provider or get_ai_provider()

    async def generate(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AIProviderResponse:
        """Generate one provider-independent AI turn through the configured router."""
        try:
            return await self._provider.chat_completion(messages=messages, tools=tools)
        except (AIProviderError, Exception) as exc:
            logger.warning("AI generation failed after attempting configured providers: %s", exc)
            return AIProviderResponse(
                content="AI services are temporarily unavailable. Please try again later."
            )

    async def send_message(
        self, db: AsyncIOMotorDatabase, user_id: str, message: str
    ) -> str:
        """
        Send a user message, process through AI Provider & Tools Agent, and persist history.

        :param db: Database instance.
        :param user_id: ID of the authenticated user.
        :param message: The user's message text.
        :return: The AI Agent's final natural language response text.
        """
        if not message or not message.strip():
            return "I didn't receive a message to respond to."

        now = datetime.now(timezone.utc)

        # Save user message to DB
        try:
            await db.chat_messages.insert_one({
                "user_id": user_id,
                "role": "user",
                "content": message.strip(),
                "created_at": now,
            })
        except PyMongoError as exc:
            logger.error("Failed to save user chat message to MongoDB: %s", exc)

        # Fetch recent conversation history for context
        recent_messages = await self._get_recent_messages(db, user_id)

        # Build dynamic system prompt with current date/time context and multi-tool instructions
        current_time_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")
        system_prompt = (
            "You are Jarvis, a highly capable and friendly AI productivity assistant. "
            "You help users manage tasks, take notes, set reminders, manage calendar events, check weather, get news, and summarize documents. "
            "When a user request requires multiple actions (for example: checking weather AND setting a reminder, or viewing tasks AND creating a note), "
            "you MUST invoke all necessary function tools (either simultaneously in one turn or sequentially across turns) before providing your final response. "
            "Combine and summarize the execution results of ALL tools into a single cohesive, natural, clear, and professional response. "
            f"The current UTC date and time is {current_time_str}. Use this exact timestamp to calculate relative dates like 'tomorrow', 'next week', or 'in 2 hours'."
        )

        openai_messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        openai_messages.extend(
            {"role": msg["role"], "content": msg["content"]}
            for msg in recent_messages
        )

        reply = ""
        max_tool_loops = 6

        try:
            for _ in range(max_tool_loops):
                # Call configured AI Provider (Gemini / OpenAI / custom)
                response = await self.generate(
                    messages=openai_messages,
                    tools=AGENT_TOOLS,
                )

                if response.tool_calls:
                    # Record assistant message with tool calls in standard message format
                    assistant_msg = {
                        "role": "assistant",
                        "content": response.content or "",
                        "tool_calls": [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.name,
                                    "arguments": json.dumps(tc.arguments),
                                },
                            }
                            for tc in response.tool_calls
                        ],
                    }
                    openai_messages.append(assistant_msg)

                    # Execute all tools returned in this turn
                    for tc in response.tool_calls:
                        tool_name = tc.name
                        tool_args = tc.arguments

                        logger.info("[AI AGENT] Executing tool '%s'", tool_name)

                        tool_result = await execute_agent_tool(tool_name, tool_args, db, user_id)

                        openai_messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": json.dumps(tool_result),
                        })
                else:
                    reply = (response.content or "").strip()
                    break
        except Exception as exc:
            logger.error("Error during AI agent execution: %s", exc)
            reply = "Something went wrong while processing your request."

        if not reply:
            reply = "Done! I've processed your request."

        # Save assistant response to DB
        try:
            await db.chat_messages.insert_one({
                "user_id": user_id,
                "role": "assistant",
                "content": reply,
                "created_at": datetime.now(timezone.utc),
            })
        except PyMongoError as exc:
            logger.error("Failed to save assistant response to MongoDB: %s", exc)

        return reply

    async def get_history(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 50
    ) -> list[dict]:
        """Retrieve chat history for the user."""
        try:
            cursor = db.chat_messages.find(
                {"user_id": user_id},
                {"_id": 1, "role": 1, "content": 1, "created_at": 1},
            ).sort("created_at", -1).limit(limit)

            messages = await cursor.to_list(length=limit)
            messages.reverse()
            for msg in messages:
                msg["id"] = str(msg.pop("_id"))
            return messages
        except PyMongoError as exc:
            logger.error("Failed to retrieve chat history from MongoDB: %s", exc)
            return []

    async def clear_history(self, db: AsyncIOMotorDatabase, user_id: str) -> int:
        """Delete all chat messages for the user."""
        try:
            result = await db.chat_messages.delete_many({"user_id": user_id})
            return result.deleted_count
        except PyMongoError as exc:
            logger.error("Failed to clear chat history from MongoDB: %s", exc)
            return 0

    async def _get_recent_messages(
        self, db: AsyncIOMotorDatabase, user_id: str
    ) -> list[dict]:
        """Fetch the most recent messages for AI context."""
        try:
            cursor = db.chat_messages.find(
                {"user_id": user_id},
                {"role": 1, "content": 1, "_id": 0},
            ).sort("created_at", -1).limit(MAX_CONTEXT_MESSAGES)

            messages = await cursor.to_list(length=MAX_CONTEXT_MESSAGES)
            messages.reverse()
            return messages
        except PyMongoError as exc:
            logger.error("Failed to fetch recent chat messages: %s", exc)
            return []


# Module-level singleton
ai_service = AIService()
