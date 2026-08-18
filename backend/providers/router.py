"""Provider router that sequentially tries primary and fallback AI providers."""

import logging
from typing import Any

from backend.providers.base import (
    AIProviderError,
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
)

logger = logging.getLogger(__name__)


class ProviderRouter(BaseAIProvider):
    """Sequential provider router (Gemini -> Groq -> OpenRouter, etc.)."""

    def __init__(
        self,
        providers: list[tuple[str, BaseAIProvider]] | None = None,
        primary: BaseAIProvider | None = None,
        primary_name: str | None = None,
        fallback: BaseAIProvider | None = None,
        fallback_name: str | None = None,
    ) -> None:
        if providers:
            self._providers = providers
        else:
            self._providers = []
            if primary and primary_name:
                self._providers.append((primary_name.lower(), primary))
            if fallback and fallback_name:
                self._providers.append((fallback_name.lower(), fallback))

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AIProviderResponse:
        if not self._providers:
            logger.error("No AI providers configured in router.")
            raise AIProviderTemporaryError("AI services are temporarily unavailable. Please try again later.")

        last_error: Exception | None = None

        for name, provider in self._providers:
            display_name = name.strip().lower()
            logger.info("Trying provider: %s", display_name)
            try:
                result = await provider.chat_completion(messages, tools)
                logger.info("%s succeeded", display_name.capitalize())
                return result
            except AIProviderError as exc:
                reason = exc.reason or str(exc)
                logger.warning("%s failed: %s", display_name.capitalize(), reason)
                last_error = exc
            except Exception as exc:
                reason = "unexpected error"
                logger.warning("%s failed: %s", display_name.capitalize(), reason)
                last_error = exc

        logger.error("All configured AI providers failed.")
        raise AIProviderTemporaryError(
            "AI services are temporarily unavailable. Please try again later."
        ) from last_error
