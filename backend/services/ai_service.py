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
from backend.services.agent_tools import AGENT_TOOLS, _format_human_datetime, execute_agent_tool
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
        tool_choice: str | dict[str, Any] | None = None,
    ) -> AIProviderResponse:
        """Generate one provider-independent AI turn through the configured router."""
        try:
            return await self._provider.chat_completion(
                messages=messages, tools=tools, tool_choice=tool_choice
            )
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

        # Fast direct execution for unambiguous local desktop control commands (bypasses remote AI & Qdrant)
        direct_desktop = self._match_direct_desktop_command(message)
        if direct_desktop is not None:
            tool_name, tool_args = direct_desktop
            tool_res = await execute_agent_tool(tool_name, tool_args, db, user_id)
            if tool_res.get("status") == "success":
                msg = tool_res.get("message") or f"Opened {tool_args.get('app_name', 'application')}."
                reply = self._strip_voice_markdown(msg) if voice_mode else msg
                if persist_history:
                    try:
                        await db.chat_messages.insert_one({
                            "user_id": user_id,
                            "conversation_id": conversation_id or "legacy",
                            "role": "assistant",
                            "content": reply,
                            "created_at": now,
                        })
                    except PyMongoError as exc:
                        logger.error("Failed to save assistant response to MongoDB: %s", exc)
                return reply
            elif tool_res.get("status") == "error":
                return tool_res.get("message") or tool_res.get("error") or "Failed to execute desktop action."

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
                "2. When a tool succeeds, reply with ONE short sentence confirming the actual action taken "
                "(e.g. 'Opening Chrome.', 'Opened YouTube.', 'Opened Downloads.', 'Screenshot taken.', "
                "'Volume increased.', 'It is 10:45 PM.').\n"
                "3. If a tool fails or reports an error, state the error truthfully in ONE short sentence "
                "(e.g. 'Could not take screenshot.', 'File not found.', 'Please specify which folder to search.'). "
                "NEVER say an action succeeded if the tool returned an error.\n"
                "4. If an action requires confirmation (such as opening an executable file or terminal), ask for confirmation in ONE short sentence.\n"
                "5. For file search requests without a specified folder, ask which folder to search (e.g. Documents, Downloads, Desktop).\n"
                "6. For view/list requests, briefly name the items (title only, no IDs, no dates unless essential).\n"
                "7. NEVER output Markdown, JSON, bullet points, IDs, UUIDs, or long explanations.\n"
                "8. NEVER say generic filler sentences like 'Done.' without confirming the actual action.\n"
                "9. For factual, mathematical, or general knowledge questions (e.g. 'What is the largest city by area?'), "
                "answer directly with concise facts and do NOT call desktop tools."
            )
        else:
            system_prompt = (
                "You are Jarvis, a highly capable and friendly AI productivity assistant. "
                "You help users manage tasks, take notes, set reminders, manage calendar events, check weather, get news, and summarize documents. "
                "You can also control Windows desktop automation: open approved applications, open websites, search the web in the browser, "
                "open folders, take screenshots, search files inside permitted user folders, open files with default applications, "
                "report current local date and time, and adjust system volume. "
                "Safety guidelines:\n"
                "- If a file search is ambiguous or omits the target folder, ask the user which folder to search (e.g. Documents, Downloads, Desktop).\n"
                "- Never attempt whole-drive searches. Only search permitted user folders.\n"
                "- Require explicit user confirmation before opening sensitive executable/script files.\n"
                "- Do not read, upload, or transmit private file contents unless the user explicitly requests it.\n"
                "- For informational and general knowledge questions (e.g. 'What is the largest city by area?'), answer directly with accurate information and do NOT invoke desktop tools.\n"
                "You also have access to the user's private knowledge base, memory, and uploaded documents in Qdrant vector storage. "
                "When a user request requires multiple actions (for example: checking weather AND setting a reminder, or taking a screenshot AND opening the folder), "
                "you MUST invoke all necessary function tools before providing your final response. "
                "Combine and summarize the execution results of ALL tools into a single cohesive, natural, clear, and professional response. "
                f"The current UTC date and time is {current_time_str}. Use this exact timestamp to calculate relative dates like 'tomorrow', 'next week', or 'in 2 hours'."
            )

        # Retrieve relevant semantic knowledge from Qdrant vector memory
        try:
            matched_knowledge = await knowledge_service.search_knowledge(
                user_id=user_id,
                query=message.strip(),
                limit=5,
                score_threshold=0.30,
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
                            voice_mode=voice_mode,
                        )
            elif decision_engine.is_productivity_request(message, decision):
                reply = await self._process_intelligence_request(
                    db=db,
                    user_id=user_id,
                    message=message,
                    messages=openai_messages,
                    decision=decision,
                    conversation_key=conversation_key,
                    voice_mode=voice_mode,
                )
            else:
                executed_tools: list[tuple[str, dict[str, Any]]] = []
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
                            executed_tools.append((tool_name, tool_result))

                            openai_messages.append({
                                "role": "tool",
                                "tool_call_id": tc.id,
                                "content": json.dumps(tool_result),
                            })

                        # In voice mode, return the tool confirmation immediately without a redundant 2nd LLM call
                        if voice_mode and executed_tools:
                            last_status = executed_tools[-1][1].get("status")
                            last_msg = executed_tools[-1][1].get("message")
                            if last_status == "success" and last_msg:
                                reply = last_msg
                                break
                            elif last_status in ("error", "requires_confirmation") and last_msg:
                                reply = last_msg
                                break
                    else:
                        reply = (response.content or "").strip()
                        break

                if executed_tools:
                    failed_tools = [res for _, res in executed_tools if res.get("status") == "error"]
                    confirmation_tools = [res for _, res in executed_tools if res.get("status") == "requires_confirmation"]

                    if failed_tools:
                        error_msg = (
                            failed_tools[0].get("error")
                            or failed_tools[0].get("message")
                            or "Action could not be completed."
                        )
                        reply_lower = reply.lower()
                        negative_cues = (
                            "error", "fail", "not", "unable", "cannot",
                            "couldn't", "could not", "sorry", "unrecognized",
                            "unsupported", "does not exist",
                        )
                        # Truthfully announce failure if AI claimed success or didn't report error
                        if (
                            not reply
                            or not any(cue in reply_lower for cue in negative_cues)
                            or reply_lower.startswith(("done", "opened", "launched", "success"))
                        ):
                            reply = error_msg
                    elif confirmation_tools:
                        conf_msg = (
                            confirmation_tools[0].get("message")
                            or "Confirmation is required to execute this action."
                        )
                        if not reply or "confirm" not in reply.lower():
                            reply = conf_msg
                    else:
                        # Success: replace generic placeholders with actual tool outcome
                        if not reply or reply in ("Done.", "Done", "Done! I've processed your request."):
                            last_msg = executed_tools[-1][1].get("message")
                            if last_msg:
                                reply = last_msg
                            else:
                                reply = "Done." if voice_mode else "Done! I've processed your request."
        except Exception as exc:
            logger.error("Error during AI agent execution: %s", exc)
            reply = "Something went wrong while processing your request."

        if not reply:
            reply = "I couldn't process your request." if voice_mode else "Done! I've processed your request."

        if voice_mode:
            reply = self._strip_voice_markdown(reply)

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
        voice_mode: bool = False,
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
                proposal = await self.generate(
                    messages=proposal_messages,
                    tools=schemas,
                    tool_choice="required" if schemas else None,
                )
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
            voice_mode=voice_mode,
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
        voice_mode: bool = False,
    ) -> str:
        if voice_mode:
            if result.status == ActionExecutionStatus.COMPLETED.value:
                if result.execution and result.execution.steps:
                    msgs = [
                        str(step.result.get("message"))
                        for step in result.execution.steps
                        if isinstance(step.result, dict) and step.result.get("message")
                    ]
                    if msgs:
                        return self._strip_voice_markdown(msgs[-1])
                return "Done. Request processed."
            if result.status == "requires_confirmation":
                return "Please confirm before I make that change."
            if result.status == "requires_clarification":
                return "Which task, note, reminder, or calendar item do you mean?"
            if result.status == "unsupported":
                return "I can't perform that action with the current ASTRA tools."
            if result.status == "no_action":
                return "I couldn't identify an action to perform. Could you clarify your request?"

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
                "role": "user",
                "content": (
                    "[Instruction: The Intelligence Engine has processed this request. Respond naturally "
                    "based on its status and execution result below. Do not call or suggest "
                    "any tools, and do not claim success unless status is completed. "
                    f"Engine result: {json.dumps(summary)}]"
                ),
            },
        ]
        response = await self.generate(messages=response_messages)
        reply = (response.content or "").strip()
        if reply and not reply.startswith("AI services are temporarily unavailable"):
            return self._strip_voice_markdown(reply) if voice_mode else reply
        if result.status == ActionExecutionStatus.COMPLETED.value:
            if result.execution and result.execution.steps:
                msgs = [
                    str(step.result.get("message"))
                    for step in result.execution.steps
                    if isinstance(step.result, dict) and step.result.get("message")
                ]
                if msgs:
                    return self._strip_voice_markdown(msgs[-1]) if voice_mode else msgs[-1]
            return "Done." if voice_mode else "Done! I've processed your request."
        return "I couldn't complete that action. Please try again."

    @staticmethod
    def _strip_voice_markdown(text: str) -> str:
        """Strip markdown syntax and sanitize raw technical data (ISO dates, JSON, ObjectIds, UUIDs)
        to ensure clean, natural spoken output for TTS without raw timestamps or metadata.
        """
        if not text:
            return ""

        # Remove markdown code blocks
        text = re.sub(r"```[\s\S]*?```", " ", text)
        # Remove inline code
        text = re.sub(r"`([^`]+)`", r"\1", text)
        # Remove images and markdown links: [text](url) -> text
        text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", text)
        text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
        # Remove standalone URLs
        text = re.sub(r"https?://\S+", "", text)
        # Remove headers (#)
        text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
        # Remove bold / italics (*, **, _, __)
        text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)
        # Remove blockquotes (>)
        text = re.sub(r"^>\s+", "", text, flags=re.MULTILINE)
        # Remove list markers (- , * , 1. )
        text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)

        # Convert raw ISO datetimes to human-spoken form if present
        def _iso_replacer(match: re.Match) -> str:
            raw = match.group(0)
            human = _format_human_datetime(raw)
            return human if human else ""

        text = re.sub(
            r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b",
            _iso_replacer,
            text,
        )

        # Strip any leftover raw timezone offsets (+00:00, -05:00) or 'Z' suffix
        text = re.sub(r"[+-]\d{2}:\d{2}\b", "", text)

        # Strip raw midnight timestamps or quad-zero artifacts ('0000', '00:00:00', '00:00')
        text = re.sub(r"\b0000\b", "", text)
        text = re.sub(r"\b00:00(?::00)?\b", "", text)

        # Strip raw MongoDB ObjectIds (24-char hex strings) and UUIDs
        text = re.sub(r"\b[0-9a-fA-F]{24}\b", "", text)
        text = re.sub(
            r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b",
            "",
            text,
        )

        # Strip raw JSON structures like {"status": "success", ...}
        text = re.sub(r"\{[^{}]*\}", "", text)

        # Strip technical identifier labels
        text = re.sub(r"\b_?id\s*:\s*\S+", "", text, flags=re.I)

        # Clean extra whitespace and punctuation
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n+", ". ", text)
        clean = text.replace("\n", " ").strip()
        # Clean trailing empty punctuation or artifacts like "for ." or "at ."
        clean = re.sub(r"\b(for|at|on|due)\s*[.,!]", ".", clean, flags=re.I)
        clean = re.sub(r"\s+([.,!?])", r"\1", clean)
        return clean.strip()

    @staticmethod
    def _match_direct_desktop_command(message: str) -> tuple[str, dict[str, Any]] | None:
        """Deterministically match common, unambiguous local desktop control requests."""
        cleaned = re.sub(r"[.!?,]+$", "", message.strip()).strip().lower()

        # Application launching
        app_patterns: list[tuple[str, str]] = [
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:notepad|text editor)$", "notepad"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:calculator|calc)$", "calculator"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:chrome|google chrome)$", "chrome"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:vs\s*code|vscode|visual studio code|code)$", "vscode"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:paint|mspaint)$", "paint"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:file explorer|explorer|windows explorer)$", "explorer"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:task manager|taskmanager)$", "task_manager"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:snipping tool|snippingtool|snip)$", "snipping_tool"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:spotify)$", "spotify"),
            (r"^(?:open|launch|start)\s+(?:the\s+)?(?:vlc|vlc media player)$", "vlc"),
        ]
        for pattern, app_name in app_patterns:
            if re.match(pattern, cleaned):
                return ("open_desktop_app", {"app_name": app_name})

        # Website opening
        website_patterns: list[tuple[str, str]] = [
            (r"^(?:open|launch|go to)\s+(?:youtube|youtube\.com)(?:\s+in\s+chrome)?$", "https://www.youtube.com"),
            (r"^(?:open|launch|go to)\s+(?:google|google\.com)(?:\s+in\s+chrome)?$", "https://www.google.com"),
            (r"^(?:open|launch|go to)\s+(?:github|github\.com)(?:\s+in\s+chrome)?$", "https://www.github.com"),
        ]
        for pattern, url in website_patterns:
            if re.match(pattern, cleaned):
                return ("open_website", {"url": url})

        # Folder opening
        folder_match = re.match(r"^(?:open|show)\s+(?:my\s+)?(downloads|documents|desktop|pictures)(?:\s+folder)?$", cleaned)
        if folder_match:
            folder_name = folder_match.group(1).capitalize()
            return ("open_folder", {"folder_name": folder_name})

        return None

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
