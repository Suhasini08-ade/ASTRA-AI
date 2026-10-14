"""
services/ai_service.py
======================
AI Agent service utilizing pluggable AI Provider architecture (Gemini / OpenAI).
"""

from datetime import datetime, timezone
import hashlib
import json
import logging
import re
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
from backend.services.knowledge_service import knowledge_service
from backend.services.intelligence_engine.decision_engine import DecisionEngine
from backend.services.intelligence_engine.engine import IntelligenceEngine
from backend.services.intelligence_engine.schemas import (
    ActionExecutionStatus,
    Decision,
    DecisionOperation,
    IntelligenceResult,
)

logger = logging.getLogger(__name__)

MAX_CONTEXT_MESSAGES = 20
PENDING_CONFIRMATION_TTL_SECONDS = 10 * 60


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
        except AIProviderConfigurationError as exc:
            logger.warning("AI provider configuration error: %s", exc)
            return AIProviderResponse(content=str(exc))
        except (AIProviderError, Exception) as exc:
            logger.warning("AI generation failed after attempting configured providers: %s", exc)
            return AIProviderResponse(
                content="AI services are temporarily unavailable. Please try again later."
            )

    async def send_message(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        message: str,
        conversation_id: str | None = None,
        persist_history: bool = True,
        voice_mode: bool = False,
    ) -> str:
        """
        Send a user message, process through AI Provider & Tools Agent, and persist history.

        :param db: Database instance.
        :param user_id: ID of the authenticated user.
        :param message: The user's message text.
        :param voice_mode: When True, uses a terse voice-optimised system prompt and skips
            history persistence. The AI executes the requested tool then replies in a single
            short confirmation sentence (e.g. "Done. Task added.") with no markdown or IDs.
        :return: The AI Agent's final natural language response text.
        """
        if not message or not message.strip():
            return "I didn't receive a message to respond to."

        message = message.strip()
        now = datetime.now(timezone.utc)
        conversation_key = self._conversation_key(conversation_id, voice_mode)
        is_confirmation = self._is_confirmation_message(message)
        try:
            pending_action = (
                await self._consume_pending_action(db, user_id, conversation_key)
                if is_confirmation
                else None
            )
            if not is_confirmation or pending_action is None:
                await self._clear_pending_action(db, user_id, conversation_key)
        except PyMongoError as exc:
            logger.error("Failed to verify a pending AI action confirmation: %s", exc)
            return "I couldn't verify the pending action. Please submit the request again."

        # Voice requests use this same agent/tool path, but intentionally do
        # not persist or inherit normal-chat context.
        if persist_history:
            try:
                await db.chat_messages.insert_one({
                    "user_id": user_id,
                    "conversation_id": conversation_id or "legacy",
                    "role": "user",
                    "content": message.strip(),
                    "created_at": now,
                })
            except PyMongoError as exc:
                logger.error("Failed to save user chat message to MongoDB: %s", exc)

        # Fetch recent conversation history for context
        recent_messages = await self._get_recent_messages(
            db, user_id, conversation_id=conversation_id, enabled=persist_history
        )

        # Build dynamic system prompt with current date/time context and multi-tool instructions
        current_time_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

        if voice_mode:
            # Voice-optimised prompt: execute first, confirm briefly, no verbosity.
            system_prompt = (
                "You are a voice-controlled AI assistant. "
                "The current UTC date and time is "
                f"{current_time_str}. "
                "Use this to resolve relative dates like 'tomorrow', 'next week', or 'in 2 hours'. "
                "Rules you MUST follow for every response:\n"
                "1. ALWAYS call the appropriate tool immediately — never just describe what you would do.\n"
                "2. After the tool succeeds reply with ONE short sentence, 5 words or fewer. "
                "Examples: 'Done. Task added.', 'Task deleted.', 'Here are your tasks.', 'Task updated.', 'Reminder set.'\n"
                "3. For view/list requests, briefly name the items (title only, no IDs, no dates unless essential).\n"
                "4. NEVER output Markdown, JSON, bullet points, IDs, UUIDs, or long explanations.\n"
                "5. NEVER say 'I can help you with that' or give generic filler sentences."
            )
        else:
            system_prompt = (
                "You are Jarvis, a highly capable and friendly AI productivity assistant. "
                "You help users manage tasks, take notes, set reminders, manage calendar events, check weather, get news, and summarize documents. "
                "You also have access to the user's private knowledge base, memory, and uploaded documents in Qdrant vector storage. "
                "When a user request requires multiple actions (for example: checking weather AND setting a reminder, or viewing tasks AND creating a note), "
                "you MUST invoke all necessary function tools (either simultaneously in one turn or sequentially across turns) before providing your final response. "
                "Combine and summarize the execution results of ALL tools into a single cohesive, natural, clear, and professional response. "
                f"The current UTC date and time is {current_time_str}. Use this exact timestamp to calculate relative dates like 'tomorrow', 'next week', or 'in 2 hours'."
            )

        # Retrieve relevant semantic knowledge from Qdrant vector memory
        try:
            matched_knowledge = await knowledge_service.search_knowledge(
                user_id=user_id,
                query=message.strip(),
                limit=3,
                score_threshold=0.45,
            )
            if matched_knowledge:
                snippets = "\n".join(
                    f"- [{item.get('title') or item.get('source', 'Knowledge')}]: {item.get('text')}"
                    for item in matched_knowledge
                )
                system_prompt += (
                    "\n\n[RELEVANT USER MEMORY & KNOWLEDGE FROM QDRANT]:\n"
                    f"{snippets}\n"
                    "Use this relevant context when answering the user's inquiry."
                )
        except Exception as k_err:
            logger.warning("Knowledge pre-fetch failed silently: %s", k_err)

        openai_messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        openai_messages.extend(
            {"role": msg["role"], "content": msg["content"]}
            for msg in recent_messages
        )
        # Voice runs without persistence so it stays out of normal Chat. Add
        # its current transcript directly to this one request; otherwise the
        # provider would receive only the system prompt and no spoken question.
        if not persist_history:
            openai_messages.append({"role": "user", "content": message.strip()})

        reply = ""
        max_tool_loops = 6

        try:
            decision_engine = DecisionEngine()
            request_message = (
                str(pending_action.get("message"))
                if pending_action is not None
                else message
            )
            decision = decision_engine.decide(user_id=user_id, message=request_message)
            if pending_action is not None:
                action_names = [action.action_name for action in decision.actions]
                arguments = pending_action.get("action_arguments")
                if (
                    not decision.confirmation_required
                    or not decision.supported
                    or any(action_name is None for action_name in action_names)
                ):
                    reply = "I couldn't verify the pending action. Please submit the request again."
                else:
                    validated_arguments = self._validate_action_argument_dicts(
                        [str(action_name) for action_name in action_names],
                        arguments,
                    )
                    if validated_arguments is None:
                        reply = "I couldn't verify the pending action. Please submit the request again."
                    else:
                        reply = await self._process_intelligence_request(
                            db=db,
                            user_id=user_id,
                            message=request_message,
                            messages=openai_messages,
                            decision=decision,
                            conversation_key=conversation_key,
                            confirmation_granted=True,
                            action_arguments_override=validated_arguments,
                        )
            elif decision_engine.is_productivity_request(message, decision):
                reply = await self._process_intelligence_request(
                    db=db,
                    user_id=user_id,
                    message=message,
                    messages=openai_messages,
                    decision=decision,
                    conversation_key=conversation_key,
                )
            else:
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
            reply = "Done." if voice_mode else "Done! I've processed your request."

        if persist_history:
            try:
                await db.chat_messages.insert_one({
                    "user_id": user_id,
                    "conversation_id": conversation_id or "legacy",
                    "role": "assistant",
                    "content": reply,
                    "created_at": datetime.now(timezone.utc),
                })
            except PyMongoError as exc:
                logger.error("Failed to save assistant response to MongoDB: %s", exc)

        return reply

    async def _process_intelligence_request(
        self,
        *,
        db: AsyncIOMotorDatabase,
        user_id: str,
        message: str,
        messages: list[dict[str, Any]],
        decision: Decision,
        conversation_key: str,
        confirmation_granted: bool = False,
        action_arguments_override: list[dict[str, Any]] | None = None,
    ) -> str:
        """Run applicable productivity requests once, only through the engine executor."""
        action_arguments = action_arguments_override
        if decision.actions and decision.supported:
            action_names = [action.action_name for action in decision.actions]
            if any(action_name is None for action_name in action_names):
                return "I couldn't safely identify the requested action. Please clarify what you want me to do."

            expected_names = [str(action_name) for action_name in action_names]
            if action_arguments is not None:
                action_arguments = self._validate_action_argument_dicts(
                    expected_names,
                    action_arguments,
                )
                if action_arguments is None:
                    return "I couldn't verify the pending action. Please submit the request again."
            else:
                schemas = [
                    tool
                    for tool in AGENT_TOOLS
                    if tool.get("type") == "function"
                    and tool.get("function", {}).get("name") in expected_names
                ]
                proposal_messages = [
                    {
                        "role": "system",
                        "content": (
                            "Propose exactly one tool call for each listed action, in this "
                            "order: "
                            f"{', '.join(expected_names)}. Do not propose other actions."
                        ),
                    },
                    *messages,
                ]
                proposal = await self.generate(messages=proposal_messages, tools=schemas)
                if proposal.tool_calls:
                    action_arguments = self._validated_action_arguments(
                        expected_names,
                        proposal.tool_calls,
                    )
                    if action_arguments is None:
                        logger.warning("Intelligence action proposal did not match the validated plan.")
                        return "I couldn't safely prepare that action. Please clarify the requested details."
                elif any(action.operation != DecisionOperation.READ for action in decision.actions):
                    return (proposal.content or "").strip() or (
                        "I couldn't safely prepare that action. Please provide the details needed to continue."
                    )
                else:
                    action_arguments = [{} for _ in expected_names]

        result = await IntelligenceEngine(db).process(
            user_id=user_id,
            message=message,
            confirmation_granted=confirmation_granted,
            action_arguments=action_arguments,
        )
        if result.status == "requires_confirmation" and action_arguments is not None:
            confirmation_details = self._confirmation_details(result, action_arguments)
            if confirmation_details is None:
                return "I couldn't identify the exact item to change. Please specify its title."
            if not await self._save_pending_action(
                db,
                user_id=user_id,
                conversation_key=conversation_key,
                message=message,
                action_arguments=action_arguments,
            ):
                return "I couldn't safely save the pending confirmation. Please submit the request again."
            return f"Please confirm: {confirmation_details}."
        return await self._generate_intelligence_reply(
            messages=messages,
            result=result,
        )

    @staticmethod
    def _confirmation_details(
        result: IntelligenceResult,
        action_arguments: list[dict[str, Any]],
    ) -> str | None:
        """Describe only destructive targets present in the authenticated context."""
        if result.plan is None or len(result.plan.steps) != len(action_arguments):
            return None

        descriptions: list[str] = []
        target_fields = {
            "task": ("task_id", result.context.tasks),
            "note": ("note_id", result.context.notes),
            "reminder": ("reminder_id", result.context.reminders),
        }
        verbs = {
            DecisionOperation.DELETE: "delete",
            DecisionOperation.UPDATE: "change",
        }
        for step, arguments in zip(result.plan.steps, action_arguments):
            if step.operation not in verbs:
                continue
            target = target_fields.get(step.resource_type)
            if target is None:
                return None
            identifier_key, items = target
            identifier = arguments.get(identifier_key)
            item = next((item for item in items if item.id == identifier), None)
            if item is None:
                return None
            title = getattr(item, "title", None) or getattr(item, "message", None)
            if not title:
                return None
            descriptions.append(
                f"{verbs[step.operation]} {step.resource_type.replace('_', ' ')} "
                f"'{title}'"
            )
        return " and ".join(descriptions) if descriptions else None

    @staticmethod
    def _validated_action_arguments(
        expected_names: list[str],
        tool_calls: list[Any],
    ) -> list[dict[str, Any]] | None:
        """Accept only arguments for the exact planned tool sequence and schemas."""
        if [call.name for call in tool_calls] != expected_names:
            return None
        return AIService._validate_action_argument_dicts(
            expected_names,
            [call.arguments for call in tool_calls],
        )

    @staticmethod
    def _validate_action_argument_dicts(
        expected_names: list[str],
        action_arguments: Any,
    ) -> list[dict[str, Any]] | None:
        if not isinstance(action_arguments, list) or len(action_arguments) != len(expected_names):
            return None
        schemas = {
            tool["function"]["name"]: tool["function"]["parameters"]
            for tool in AGENT_TOOLS
            if tool.get("type") == "function"
            and tool.get("function", {}).get("name") in expected_names
        }
        validated: list[dict[str, Any]] = []
        for action_name, arguments in zip(expected_names, action_arguments):
            schema = schemas[action_name]
            properties = schema.get("properties", {})
            if not isinstance(arguments, dict) or any(
                key not in properties for key in arguments
            ):
                return None
            if any(key not in arguments for key in schema.get("required", [])):
                return None

            for key, value in arguments.items():
                expected_type = properties[key].get("type")
                valid_type = {
                    "string": lambda item: isinstance(item, str),
                    "array": lambda item: isinstance(item, list),
                    "boolean": lambda item: isinstance(item, bool),
                    "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
                    "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
                    "object": lambda item: isinstance(item, dict),
                }.get(expected_type)
                if valid_type and not valid_type(value):
                    return None
                if "enum" in properties[key] and value not in properties[key]["enum"]:
                    return None

            validated.append(arguments)
        return validated

    @staticmethod
    def _conversation_key(conversation_id: str | None, voice_mode: bool) -> str:
        if voice_mode:
            return f"voice:{conversation_id or 'default'}"
        return conversation_id or "legacy"

    @staticmethod
    def _is_confirmation_message(message: str) -> bool:
        return bool(
            re.fullmatch(
                r"\s*(?:yes|confirm|confirmed|go ahead|proceed|do it|sure)\s*[.!]*\s*",
                message,
                re.IGNORECASE,
            )
        )

    @staticmethod
    def _pending_action_id(user_id: str, conversation_key: str) -> str:
        key = f"{user_id}\0{conversation_key}".encode("utf-8")
        return hashlib.sha256(key).hexdigest()

    async def _save_pending_action(
        self,
        db: AsyncIOMotorDatabase,
        *,
        user_id: str,
        conversation_key: str,
        message: str,
        action_arguments: list[dict[str, Any]],
    ) -> bool:
        now = datetime.now(timezone.utc)
        try:
            await db.ai_pending_actions.update_one(
                {
                    "_id": self._pending_action_id(user_id, conversation_key),
                    "user_id": user_id,
                    "conversation_key": conversation_key,
                },
                {
                    "$set": {
                        "user_id": user_id,
                        "conversation_key": conversation_key,
                        "message": message,
                        "action_arguments": action_arguments,
                        "created_at": now,
                        "expires_at": now.timestamp() + PENDING_CONFIRMATION_TTL_SECONDS,
                    }
                },
                upsert=True,
            )
            return True
        except PyMongoError as exc:
            logger.error("Failed to save pending AI action confirmation: %s", exc)
            return False

    async def _consume_pending_action(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        conversation_key: str,
    ) -> dict[str, Any] | None:
        now = datetime.now(timezone.utc).timestamp()
        return await db.ai_pending_actions.find_one_and_delete(
            {
                "_id": self._pending_action_id(user_id, conversation_key),
                "user_id": user_id,
                "conversation_key": conversation_key,
                "expires_at": {"$gt": now},
            }
        )

    async def _clear_pending_action(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        conversation_key: str,
    ) -> None:
        await db.ai_pending_actions.delete_one(
            {
                "_id": self._pending_action_id(user_id, conversation_key),
                "user_id": user_id,
                "conversation_key": conversation_key,
            }
        )

    async def _generate_intelligence_reply(
        self,
        *,
        messages: list[dict[str, Any]],
        result: IntelligenceResult,
    ) -> str:
        """Use the configured provider for wording, never for a second tool action."""
        if result.status == "requires_confirmation":
            return "Please confirm before I make that change."
        if result.status == "requires_clarification":
            return "Which task, note, reminder, or calendar item do you mean?"
        if result.status == "unsupported":
            return "I can't perform that action with the current ASTRA tools."
        if result.status == "no_action":
            return "I couldn't identify an action to perform. Could you clarify your request?"

        summary = {
            "status": result.status,
            "actions": [
                step.action_name for step in (result.plan.steps if result.plan else [])
            ],
            "execution": (
                result.execution.model_dump(mode="json")
                if result.execution is not None
                else None
            ),
        }
        response_messages = [
            *messages,
            {
                "role": "assistant",
                "content": (
                    "The Intelligence Engine has processed this request. Respond naturally "
                    "based on its status and execution result below. Do not call or suggest "
                    "any tools, and do not claim success unless status is completed. "
                    f"Engine result: {json.dumps(summary)}"
                ),
            },
        ]
        response = await self.generate(messages=response_messages)
        reply = (response.content or "").strip()
        if reply and not reply.startswith("AI services are temporarily unavailable"):
            return reply
        if result.status == ActionExecutionStatus.COMPLETED.value:
            return "Done! I've processed your request."
        return "I couldn't complete that action. Please try again."

    async def get_history(
        self, db: AsyncIOMotorDatabase, user_id: str, limit: int = 50, conversation_id: str | None = None
    ) -> list[dict]:
        """Retrieve chat history for the user."""
        try:
            query: dict[str, Any] = {"user_id": user_id}
            if conversation_id:
                if conversation_id == "legacy":
                    query["$or"] = [
                        {"conversation_id": "legacy"},
                        {"conversation_id": {"$exists": False}},
                    ]
                else:
                    query["conversation_id"] = conversation_id
            cursor = db.chat_messages.find(
                query,
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
        self, db: AsyncIOMotorDatabase, user_id: str, conversation_id: str | None = None, enabled: bool = True
    ) -> list[dict]:
        """Fetch the most recent messages for AI context."""
        if not enabled:
            return []
        try:
            query: dict[str, Any] = {"user_id": user_id}
            if conversation_id:
                query["conversation_id"] = conversation_id
            cursor = db.chat_messages.find(
                query,
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
