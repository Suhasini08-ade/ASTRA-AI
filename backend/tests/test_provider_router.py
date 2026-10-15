import unittest
from typing import Any

from backend.providers.base import (
    AIProviderConfigurationError,
    AIProviderRequestError,
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
    ToolCallItem,
)
from backend.providers.router import ProviderRouter
from backend.services.ai_service import AIService


class StubProvider(BaseAIProvider):
    def __init__(self, result: AIProviderResponse | Exception) -> None:
        self.result = result
        self.calls: list[tuple[list[dict[str, Any]], list[dict[str, Any]] | None]] = []

    async def chat_completion(
        self, messages: list[dict[str, Any]], tools: list[dict[str, Any]] | None = None
    ) -> AIProviderResponse:
        self.calls.append((messages, tools))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


class ProviderRouterTests(unittest.IsolatedAsyncioTestCase):
    async def test_primary_success_is_returned(self) -> None:
        primary = StubProvider(AIProviderResponse(content="gemini response"))
        fallback = StubProvider(AIProviderResponse(content="groq response"))

        result = await ProviderRouter(primary, "gemini", fallback, "groq").chat_completion([])

        self.assertEqual(result.content, "gemini response")
        self.assertEqual(len(fallback.calls), 0)

    async def test_429_uses_fallback(self) -> None:
        primary = StubProvider(AIProviderTemporaryError(status_code=429))
        fallback = StubProvider(AIProviderResponse(content="groq response"))

        result = await ProviderRouter(primary, "gemini", fallback, "groq").chat_completion([])

        self.assertEqual(result.content, "groq response")
        self.assertEqual(len(fallback.calls), 1)

    async def test_temporary_unavailability_uses_fallback(self) -> None:
        primary = StubProvider(AIProviderTemporaryError(status_code=503))
        fallback = StubProvider(AIProviderResponse(content="fallback response"))

        result = await ProviderRouter(primary, "gemini", fallback, "groq").chat_completion([])

        self.assertEqual(result.content, "fallback response")

    async def test_configuration_error_does_not_use_fallback(self) -> None:
        primary = StubProvider(AIProviderConfigurationError("Gemini is not configured."))
        fallback = StubProvider(AIProviderResponse(content="must not be used"))

        with self.assertRaises(AIProviderConfigurationError):
            await ProviderRouter(primary, "gemini", fallback, "groq").chat_completion([])

        self.assertEqual(len(fallback.calls), 0)

    async def test_non_retryable_request_error_does_not_use_fallback(self) -> None:
        primary = StubProvider(AIProviderRequestError(status_code=400))
        fallback = StubProvider(AIProviderResponse(content="must not be used"))

        with self.assertRaises(AIProviderRequestError):
            await ProviderRouter(primary, "gemini", fallback, "groq").chat_completion([])

        self.assertEqual(len(fallback.calls), 0)

    async def test_both_temporary_failures_return_temporary_error(self) -> None:
        primary = StubProvider(AIProviderTemporaryError(status_code=429))
        fallback = StubProvider(AIProviderTemporaryError(status_code=503))

        with self.assertRaises(AIProviderTemporaryError):
            await ProviderRouter(primary, "gemini", fallback, "groq").chat_completion([])

    async def test_ai_service_returns_clean_message_when_provider_is_unavailable(self) -> None:
        service = AIService(provider=StubProvider(AIProviderTemporaryError(status_code=503)))

        result = await service.generate([])

        self.assertEqual(result.content, "AI services are temporarily unavailable. Please try again later.")

    async def test_ai_service_returns_configuration_message_without_fallback(self) -> None:
        service = AIService(
            provider=StubProvider(AIProviderConfigurationError("Gemini is not configured."))
        )

        result = await service.generate([])

        self.assertEqual(result.content, "Gemini is not configured.")

    async def test_tool_calls_and_tool_schema_are_preserved_on_fallback(self) -> None:
        messages = [{"role": "user", "content": "Create a task"}]
        tools = [{"type": "function", "function": {"name": "create_task"}}]
        primary = StubProvider(AIProviderTemporaryError(status_code=429))
        fallback = StubProvider(
            AIProviderResponse(
                tool_calls=[ToolCallItem(id="call-1", name="create_task", arguments={"title": "Plan"})]
            )
        )

        result = await ProviderRouter(primary, "gemini", fallback, "groq").chat_completion(messages, tools)

        self.assertEqual(result.tool_calls[0].name, "create_task")
        self.assertEqual(fallback.calls[0], (messages, tools))


if __name__ == "__main__":
    unittest.main()
