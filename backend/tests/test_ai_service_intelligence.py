"""Integration coverage for the controlled Intelligence Engine in AIService."""

from collections import deque
from typing import Any
import unittest
from unittest.mock import AsyncMock, patch

from backend.providers.base import (
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
    ToolCallItem,
)
from backend.providers.router import ProviderRouter
from backend.services.ai_service import AIService
from backend.services.agent_tools import AGENT_TOOLS


class StubProvider(BaseAIProvider):
    def __init__(self, *responses: AIProviderResponse | Exception) -> None:
        self.responses = deque(responses)
        self.calls: list[tuple[list[dict[str, Any]], list[dict[str, Any]] | None]] = []

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AIProviderResponse:
        self.calls.append((messages, tools))
        if not self.responses:
            return AIProviderResponse(content="Done.")
        response = self.responses.popleft()
        if isinstance(response, Exception):
            raise response
        return response


class FakeCursor:
    def __init__(self, documents: list[dict[str, Any]]) -> None:
        self.documents = documents

    def sort(self, *_args: Any, **_kwargs: Any) -> "FakeCursor":
        return self

    def limit(self, *_args: Any, **_kwargs: Any) -> "FakeCursor":
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        return self.documents[:length] if length is not None else self.documents


class FakeCollection:
    def __init__(self) -> None:
        self.documents: dict[str, dict[str, Any]] = {}

    def find(self, *_args: Any, **_kwargs: Any) -> FakeCursor:
        return FakeCursor(list(self.documents.values()))

    async def insert_one(self, _document: dict[str, Any]) -> None:
        return None

    async def update_one(
        self,
        query: dict[str, Any],
        update: dict[str, Any],
        *,
        upsert: bool = False,
    ) -> None:
        document_id = query["_id"]
        if upsert or document_id in self.documents:
            self.documents[document_id] = {"_id": document_id, **update["$set"]}

    async def find_one_and_delete(self, query: dict[str, Any]) -> dict[str, Any] | None:
        document = self.documents.get(query["_id"])
        if not document:
            return None
        if any(
            document.get(key) != value
            for key, value in query.items()
            if key not in {"_id", "expires_at"}
        ):
            return None
        expiration = query.get("expires_at", {}).get("$gt")
        if expiration is not None and document.get("expires_at", 0) <= expiration:
            return None
        return self.documents.pop(query["_id"])

    async def delete_one(self, query: dict[str, Any]) -> None:
        self.documents.pop(query["_id"], None)


class FakeDatabase:
    def __init__(self) -> None:
        self.chat_messages = FakeCollection()
        self.ai_pending_actions = FakeCollection()
        self.tasks = FakeCollection()
        self.notes = FakeCollection()
        self.reminders = FakeCollection()
        self.calendar_events = FakeCollection()
        self.focus_sessions = FakeCollection()
        self.settings = FakeCollection()


def function_call(call_id: str, name: str, **arguments: Any) -> ToolCallItem:
    return ToolCallItem(id=call_id, name=name, arguments=arguments)


class AIServiceIntelligenceIntegrationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.db = FakeDatabase()
        self.user_id = "authenticated-firebase-user"
        self.dispatcher = AsyncMock(return_value={"status": "success", "message": "Done."})

    async def send(
        self,
        provider: BaseAIProvider,
        message: str,
        **kwargs: Any,
    ) -> str:
        service = AIService(provider=provider)
        with patch(
            "backend.services.intelligence_engine.action_executor.execute_agent_tool",
            new=self.dispatcher,
        ), patch(
            "backend.services.ai_service.execute_agent_tool",
            new=self.dispatcher,
        ):
            return await service.send_message(
                self.db,
                self.user_id,
                message,
                **kwargs,
            )

    async def test_normal_conversation_uses_existing_provider_path(self) -> None:
        provider = StubProvider(AIProviderResponse(content="Hello!"))

        reply = await self.send(provider, "Tell me a joke about my tasks.")

        self.assertEqual(reply, "Hello!")
        self.assertEqual(provider.calls[0][1], AGENT_TOOLS)
        self.dispatcher.assert_not_awaited()

    async def test_task_creation_runs_once_with_authenticated_user(self) -> None:
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[function_call("proposal", "create_task", title="Study DAA")]
            ),
            AIProviderResponse(content="I created the Study DAA task."),
        )

        reply = await self.send(provider, "Create a task to study DAA.")

        self.assertEqual(reply, "I created the Study DAA task.")
        self.dispatcher.assert_awaited_once_with(
            "create_task",
            {"title": "Study DAA"},
            self.db,
            self.user_id,
        )
        self.assertIsNone(provider.calls[-1][1])

    async def test_task_reading_uses_engine_executor(self) -> None:
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[function_call("proposal", "view_tasks")]
            ),
            AIProviderResponse(content="You have two open tasks."),
        )

        reply = await self.send(provider, "Show my tasks.")

        self.assertEqual(reply, "You have two open tasks.")
        self.dispatcher.assert_awaited_once_with("view_tasks", {}, self.db, self.user_id)
        self.assertIsNot(provider.calls[0][1], AGENT_TOOLS)

    async def test_multi_action_request_executes_planned_steps_once_each(self) -> None:
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    function_call("task", "create_task", title="Study DAA"),
                    function_call(
                        "reminder",
                        "create_reminder",
                        message="Study DAA",
                        due_time="2026-10-13T09:00:00Z",
                    ),
                ]
            ),
            AIProviderResponse(content="I created the task and reminder."),
        )

        reply = await self.send(
            provider,
            "Create a task to study DAA and remind me tomorrow.",
        )

        self.assertEqual(reply, "I created the task and reminder.")
        self.assertEqual(
            [call.args[0] for call in self.dispatcher.await_args_list],
            ["create_task", "create_reminder"],
        )
        self.assertTrue(
            all(call.args[3] == self.user_id for call in self.dispatcher.await_args_list)
        )

    async def test_deletion_requires_confirmation_then_executes_once(self) -> None:
        task_id = "507f1f77bcf86cd799439011"
        self.db.tasks.documents[task_id] = {
            "_id": task_id,
            "title": "Old task",
            "status": "todo",
        }
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    function_call(
                        "delete-proposal",
                        "delete_task",
                        task_id=task_id,
                    )
                ]
            ),
            AIProviderResponse(content="The task has been deleted."),
        )
        service = AIService(provider=provider)
        with patch(
            "backend.services.intelligence_engine.action_executor.execute_agent_tool",
            new=self.dispatcher,
        ), patch("backend.services.ai_service.execute_agent_tool", new=self.dispatcher):
            initial_reply = await service.send_message(
                self.db,
                self.user_id,
                "Delete my old task.",
                conversation_id="conversation-1",
            )
            self.assertIn("confirm", initial_reply.lower())
            self.assertIn("Old task", initial_reply)
            self.dispatcher.assert_not_awaited()

            confirmed_reply = await service.send_message(
                self.db,
                self.user_id,
                "Yes.",
                conversation_id="conversation-1",
            )
            second_confirmation_reply = await service.send_message(
                self.db,
                self.user_id,
                "Yes.",
                conversation_id="conversation-1",
            )

        self.assertEqual(confirmed_reply, "The task has been deleted.")
        self.assertNotEqual(second_confirmation_reply, "The task has been deleted.")
        self.dispatcher.assert_awaited_once_with(
            "delete_task",
            {"task_id": task_id},
            self.db,
            self.user_id,
        )
        self.assertEqual(len(provider.calls), 3)

    async def test_unresolved_delete_target_is_never_queued_for_confirmation(self) -> None:
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[
                    function_call(
                        "delete-proposal",
                        "delete_task",
                        task_id="507f1f77bcf86cd799439011",
                    )
                ]
            )
        )

        reply = await self.send(provider, "Delete my old task.")

        self.assertIn("couldn't identify", reply)
        self.assertEqual(self.db.ai_pending_actions.documents, {})
        self.dispatcher.assert_not_awaited()

    async def test_ambiguous_productivity_request_returns_clarification(self) -> None:
        provider = StubProvider()

        reply = await self.send(provider, "Remove that.")

        self.assertIn("Which", reply)
        self.assertEqual(provider.calls, [])
        self.dispatcher.assert_not_awaited()

    async def test_unsupported_productivity_action_never_reaches_provider_tool_loop(self) -> None:
        provider = StubProvider()

        reply = await self.send(provider, "Delete my calendar event.")

        self.assertIn("can't perform", reply)
        self.assertEqual(provider.calls, [])
        self.dispatcher.assert_not_awaited()

    async def test_configured_provider_fallback_remains_available(self) -> None:
        primary = StubProvider(AIProviderTemporaryError(status_code=503))
        fallback = StubProvider(AIProviderResponse(content="A fallback joke."))
        router = ProviderRouter(primary, "primary", fallback, "fallback")

        reply = await self.send(router, "Tell me a joke.")

        self.assertEqual(reply, "A fallback joke.")
        self.assertEqual(len(fallback.calls), 1)
        self.dispatcher.assert_not_awaited()

    async def test_engine_result_cannot_be_executed_again_by_model_tool_loop(self) -> None:
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[function_call("proposal", "create_task", title="Do not duplicate")]
            ),
            AIProviderResponse(
                content="The task was created.",
                tool_calls=[
                    function_call("duplicate", "create_task", title="Do not duplicate")
                ],
            ),
        )

        reply = await self.send(provider, "Create a task to avoid duplicate execution.")

        self.assertEqual(reply, "The task was created.")
        self.dispatcher.assert_awaited_once()
        self.assertIsNone(provider.calls[-1][1])

    async def test_existing_weather_tool_loop_remains_functional(self) -> None:
        provider = StubProvider(
            AIProviderResponse(
                tool_calls=[function_call("weather", "get_weather", location="Latur")]
            ),
            AIProviderResponse(content="It is sunny in Latur."),
        )

        reply = await self.send(provider, "What is the weather in Latur?")

        self.assertEqual(reply, "It is sunny in Latur.")
        self.dispatcher.assert_awaited_once_with(
            "get_weather",
            {"location": "Latur"},
            self.db,
            self.user_id,
        )
        self.assertEqual(provider.calls[0][1], AGENT_TOOLS)


if __name__ == "__main__":
    unittest.main()
