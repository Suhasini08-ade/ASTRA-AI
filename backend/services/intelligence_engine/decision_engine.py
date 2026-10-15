"""Deterministic, non-executing request classification for ASTRA."""

import re

from backend.services.agent_tools import AGENT_TOOLS
from backend.services.intelligence_engine.schemas import (
    Decision,
    DecisionAction,
    DecisionCategory,
    DecisionOperation,
    DecisionReason,
    IntelligenceContext,
)


AVAILABLE_TOOL_NAMES = frozenset(
    tool["function"]["name"]
    for tool in AGENT_TOOLS
    if tool.get("type") == "function" and tool.get("function", {}).get("name")
)


class DecisionEngine:
    """Classify a request using only explicit local rules.

    The engine is deliberately stateless: it performs no database access,
    provider invocation, planning, or action execution. ``user_id`` is accepted
    only to preserve the future engine interface; it is never parsed from or
    replaced by natural-language content.
    """

    _RESOURCE_PATTERNS = {
        "task": r"\b(?:task|tasks|to-?do)\b",
        "note": r"\b(?:note|notes)\b|\bwrite\s+down\b",
        "reminder": r"\b(?:remind|reminder|reminders)\b",
        "calendar_event": r"\b(?:calendar|schedule|agenda|meeting|meetings|event|events|appointment|appointments)\b",
        "weather": r"\b(?:weather|forecast|temperature)\b",
        "news": r"\b(?:news|headlines?)\b",
        "document": r"\b(?:document|pdf|file|summari[sz]e|summary)\b",
        "focus_session": r"\b(?:focus session|focus sessions|pomodoro|focus timer)\b",
        "chat_history": r"\b(?:chat history|conversation history|message history)\b",
    }
    _TOOL_MAP = {
        ("task", DecisionOperation.READ): "view_tasks",
        ("task", DecisionOperation.CREATE): "create_task",
        ("task", DecisionOperation.UPDATE): "update_task",
        ("task", DecisionOperation.DELETE): "delete_task",
        ("note", DecisionOperation.READ): "view_notes",
        ("note", DecisionOperation.CREATE): "create_note",
        ("note", DecisionOperation.UPDATE): "update_note",
        ("note", DecisionOperation.DELETE): "delete_note",
        ("reminder", DecisionOperation.READ): "view_reminders",
        ("reminder", DecisionOperation.CREATE): "create_reminder",
        ("reminder", DecisionOperation.UPDATE): "update_reminder",
        ("reminder", DecisionOperation.DELETE): "delete_reminder",
        ("calendar_event", DecisionOperation.READ): "view_calendar_events",
        ("calendar_event", DecisionOperation.CREATE): "create_calendar_event",
        ("calendar_event", DecisionOperation.UPDATE): "update_calendar_event",
        ("calendar_event", DecisionOperation.DELETE): "delete_calendar_event",
        ("weather", DecisionOperation.READ): "get_weather",
        ("news", DecisionOperation.READ): "get_news",
        ("document", DecisionOperation.ANALYZE): "summarize_document",
    }
    _DELETE_PATTERN = re.compile(r"\b(?:delete|remove|discard|erase|cancel)\b")
    _UPDATE_PATTERN = re.compile(r"\b(?:update|change|move|reschedule|edit|rename|mark)\b")
    _CREATE_PATTERN = re.compile(r"\b(?:create|add|make|new|set)\b")
    _READ_PATTERN = re.compile(r"\b(?:show|list|view|see|find|what|when|which|check|display)\b")
    _ANALYZE_PATTERN = re.compile(r"\b(?:what should i work on|prioriti[sz]e|plan|analy[sz]e|suggest|recommend)\b")
    _CONVERSATIONAL_PATTERN = re.compile(r"\b(?:hello|hi|hey|joke|thanks|thank you|who are you)\b")
    _AMBIGUOUS_PATTERN = re.compile(r"^\s*(?:can you )?(?:handle|manage|help with) (?:my )?(?:tasks?|notes?|reminders?|calendar)?\s*[?!.]*$|^\s*(?:remove|delete|change|update) that\s*[?!.]*$")
    _PRODUCTIVITY_RESOURCES = frozenset({"task", "note", "reminder", "calendar_event"})
    _PRODUCTIVITY_ACTION_PATTERN = re.compile(
        r"\b(?:create|add|make|set|delete|remove|discard|erase|cancel|update|change|"
        r"move|reschedule|edit|rename|mark|show|list|view|see|find|check|display|"
        r"retrieve)\b(?:\W+\w+){0,6}\W+\b(?:tasks?|to-?dos?|notes?|reminders?|"
        r"calendar|schedule|agenda|meetings?|events?|appointments?)\b"
    )
    _PRODUCTIVITY_READ_QUESTION_PATTERN = re.compile(
        r"\bwhat\s+(?:are|is)\s+(?:my\s+)?(?:tasks?|to-?dos?|notes?|reminders?|"
        r"calendar|schedule|agenda|meetings?|events?|appointments?)\b"
    )
    _NON_PRODUCTIVITY_CONTENT_PATTERN = re.compile(
        r"\b(?:joke|story|song|poem|recipe)\b"
    )

    def decide(
        self,
        *,
        user_id: str,
        message: str,
        context: IntelligenceContext | None = None,
    ) -> Decision:
        """Return an explainable decision without accessing or changing data."""
        del user_id  # Authentication remains the caller's boundary; no user data is used here.
        text = (message or "").strip()
        lowered = text.lower()

        if not text or self._AMBIGUOUS_PATTERN.match(lowered):
            return self._clarification_decision(
                "The request does not identify a specific supported action and resource."
            )

        if self._ANALYZE_PATTERN.search(lowered):
            return Decision(
                category=DecisionCategory.ANALYZE,
                reasons=[DecisionReason(message="Request asks for productivity analysis or prioritization.")],
                confidence=0.9,
            )

        resources = self._resources_in(lowered)
        if not resources:
            if self._CONVERSATIONAL_PATTERN.search(lowered):
                return Decision(
                    category=DecisionCategory.CONVERSATIONAL,
                    reasons=[DecisionReason(message="Request does not require user data access.")],
                )
            return self._clarification_decision(
                "Request does not identify a supported ASTRA resource or action."
            )

        operation = self._operation_for(lowered, resources)
        actions = [self._action_for(resource, operation) for resource in resources]
        supported = all(action.supported for action in actions)
        confirmation_required = any(action.confirmation_required for action in actions)

        if len(actions) > 1:
            category = DecisionCategory.MULTI_ACTION
        elif operation == DecisionOperation.READ:
            category = DecisionCategory.READ
        elif operation == DecisionOperation.CREATE:
            category = DecisionCategory.CREATE
        elif operation == DecisionOperation.UPDATE:
            category = DecisionCategory.UPDATE
        elif operation == DecisionOperation.DELETE:
            category = DecisionCategory.DELETE
        else:
            category = DecisionCategory.ANALYZE

        reasons = [self._reason_for(action) for action in actions]
        if len(actions) > 1:
            reasons.append(DecisionReason(message="Multiple supported resource actions were detected."))
        if not supported:
            reasons.append(DecisionReason(message="At least one requested action is not available in the existing agent-tool allowlist."))
        if confirmation_required:
            reasons.append(DecisionReason(message="A material update or destructive action requires confirmation."))

        return Decision(
            category=category,
            actions=actions,
            confirmation_required=confirmation_required,
            supported=supported,
            confidence=0.95 if supported else 0.8,
            reasons=reasons,
        )

    def is_productivity_request(self, message: str, decision: Decision | None = None) -> bool:
        """Identify requests the controlled engine should own, including ambiguity."""
        lowered = (message or "").strip().lower()
        if self._AMBIGUOUS_PATTERN.match(lowered):
            return True

        if decision is None:
            decision = self.decide(user_id="", message=message)
        resources = self._resources_in(lowered)
        if not self._PRODUCTIVITY_RESOURCES.intersection(resources):
            return False

        return bool(
            re.search(r"\bremind\s+me\b", lowered)
            or self._PRODUCTIVITY_READ_QUESTION_PATTERN.search(lowered)
            or (
                self._PRODUCTIVITY_ACTION_PATTERN.search(lowered)
                and not self._NON_PRODUCTIVITY_CONTENT_PATTERN.search(lowered)
            )
        )

    def _resources_in(self, text: str) -> list[str]:
        matched = [
            resource
            for resource, pattern in self._RESOURCE_PATTERNS.items()
            if re.search(pattern, text)
        ]
        if len(matched) <= 1:
            return matched

        # If multiple resource words are found, check if it's genuinely a multi-action request
        # (joined by conjunctions like "and", "also", "then" followed by an action/resource),
        # or if one is the direct target and others are incidental words in the title/description.
        has_multi_intent = bool(re.search(r"\b(?:and|also|then|as well as)\b.*?\b(?:remind|task|note|calendar|schedule|create|add|make|delete)\b", text))
        if not has_multi_intent:
            action_direct_match = re.search(
                r"\b(?:create|add|make|set|new|delete|remove|update|change|mark|show|list|view|remind)\s+(?:me\s+)?(?:a|an|the|my)?\s*(task|todo|to-do|note|reminder|calendar|event|meeting|weather|news)\b",
                text
            )
            if action_direct_match:
                direct_kw = action_direct_match.group(1).lower()
                direct_map = {
                    "task": "task", "todo": "task", "to-do": "task",
                    "note": "note",
                    "reminder": "reminder",
                    "calendar": "calendar_event", "event": "calendar_event", "meeting": "calendar_event",
                    "weather": "weather",
                    "news": "news",
                }
                primary_res = direct_map.get(direct_kw)
                if primary_res and primary_res in matched:
                    return [primary_res]

        return matched

    def _operation_for(self, text: str, resources: list[str]) -> DecisionOperation:
        if "document" in resources and re.search(r"\b(?:summari[sz]e|summary)\b", text):
            return DecisionOperation.ANALYZE
        if self._DELETE_PATTERN.search(text):
            return DecisionOperation.DELETE
        if self._UPDATE_PATTERN.search(text):
            return DecisionOperation.UPDATE
        if self._CREATE_PATTERN.search(text) or (
            "reminder" in resources and re.search(r"\bremind me\b", text)
        ):
            return DecisionOperation.CREATE
        # Weather and news queries are reads without a leading retrieval verb.
        return DecisionOperation.READ

    def _action_for(self, resource: str, operation: DecisionOperation) -> DecisionAction:
        action_name = self._TOOL_MAP.get((resource, operation))
        supported = action_name in AVAILABLE_TOOL_NAMES if action_name else False
        # Confirmation is never required at the decision layer.
        # The agent tools resolve items by title/ID before executing, so if the
        # item cannot be found they return an error rather than acting blindly.
        # Removing this gate lets voice and chat DELETE/UPDATE commands execute
        # immediately without a separate confirmation round-trip.
        confirmation_required = False
        return DecisionAction(
            action_name=action_name if supported else None,
            resource_type=resource,
            operation=operation,
            supported=supported,
            confirmation_required=confirmation_required,
        )

    @staticmethod
    def _reason_for(action: DecisionAction) -> DecisionReason:
        if not action.supported:
            return DecisionReason(
                message=f"ASTRA has no existing agent tool for {action.operation.value} {action.resource_type}."
            )
        action_words = {
            DecisionOperation.READ: "retrieve existing",
            DecisionOperation.CREATE: "create a new",
            DecisionOperation.UPDATE: "update existing",
            DecisionOperation.DELETE: "delete existing",
            DecisionOperation.ANALYZE: "analyze",
        }
        return DecisionReason(
            message=f"Request asks to {action_words[action.operation]} {action.resource_type.replace('_', ' ')} data."
        )

    @staticmethod
    def _clarification_decision(reason: str) -> Decision:
        return Decision(
            category=DecisionCategory.UNKNOWN,
            requires_clarification=True,
            supported=False,
            confidence=0.25,
            reasons=[DecisionReason(message=reason)],
        )
