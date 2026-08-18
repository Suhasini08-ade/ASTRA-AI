"""
providers/gemini_provider.py
=============================
Google Gemini AI Provider implementation of BaseAIProvider.
Uses Gemini's official OpenAI-compatible REST API endpoint.
"""

import json
import logging
from typing import Any

from openai import APIStatusError, APIConnectionError, APITimeoutError, AsyncOpenAI, OpenAIError

from backend.config import get_settings
from backend.providers.base import (
    AIProviderConfigurationError,
    AIProviderRequestError,
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
    ToolCallItem,
)

logger = logging.getLogger(__name__)

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


class GeminiProvider(BaseAIProvider):
    """Google Gemini Provider using official OpenAI-compatible endpoint."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        key = api_key or settings.GEMINI_API_KEY
        self._model = model or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self._client: AsyncOpenAI | None = None

        if key:
            self._client = AsyncOpenAI(api_key=key, base_url=GEMINI_BASE_URL)

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AIProviderResponse:
        if not self._client:
            raise AIProviderConfigurationError(
                "Gemini is not configured. Set GEMINI_API_KEY in backend/.env.",
                provider="gemini",
                reason="missing API key",
            )

        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 700,
        }

        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        try:
            response = await self._client.chat.completions.create(**kwargs)
            choice = response.choices[0].message

            tool_calls: list[ToolCallItem] = []
            if choice.tool_calls:
                for tc in choice.tool_calls:
                    try:
                        args = json.loads(tc.function.arguments or "{}")
                    except Exception:
                        args = {}
                    tool_calls.append(
                        ToolCallItem(id=tc.id, name=tc.function.name, arguments=args)
                    )

            return AIProviderResponse(
                content=(choice.content or "").strip() if not choice.tool_calls else None,
                tool_calls=tool_calls,
            )

        except APIStatusError as exc:
            status_code = exc.status_code
            logger.warning("Gemini request failed with status %s", status_code)
            if status_code in {401, 403}:
                raise AIProviderConfigurationError(
                    "Gemini configuration is invalid. Verify GEMINI_API_KEY in backend/.env.",
                    provider="gemini",
                    reason="invalid API key or authentication failure",
                    status_code=status_code,
                ) from exc
            if status_code == 404:
                raise AIProviderConfigurationError(
                    "Gemini model is unavailable.",
                    provider="gemini",
                    reason="model unavailable",
                    status_code=status_code,
                ) from exc
            if status_code == 429:
                raise AIProviderTemporaryError(
                    "Gemini rate limit or quota exceeded.",
                    provider="gemini",
                    reason="quota exceeded / rate limit",
                    status_code=status_code,
                ) from exc
            if status_code in {408, 500, 502, 503, 504}:
                raise AIProviderTemporaryError(
                    "Gemini service is temporarily unavailable.",
                    provider="gemini",
                    reason="temporary service unavailable",
                    status_code=status_code,
                ) from exc
            raise AIProviderRequestError(
                "Gemini request failed.",
                provider="gemini",
                reason=f"status code {status_code}",
                status_code=status_code,
            ) from exc
        except (APIConnectionError, APITimeoutError) as exc:
            logger.warning("Gemini request could not reach the service")
            raise AIProviderTemporaryError(
                "Gemini connection timeout or network error.",
                provider="gemini",
                reason="temporary service unavailable",
            ) from exc
        except OpenAIError as exc:
            logger.warning("Gemini request failed: %s", exc)
            err_msg = str(exc).lower()
            if any(marker in err_msg for marker in ("invalid api key", "authentication", "unauthorized")):
                raise AIProviderConfigurationError(
                    "Gemini configuration is invalid.",
                    provider="gemini",
                    reason="invalid API key or authentication failure",
                ) from exc
            if any(marker in err_msg for marker in ("model_not_found", "does not exist", "not found")):
                raise AIProviderConfigurationError(
                    "Gemini model unavailable.",
                    provider="gemini",
                    reason="model unavailable",
                ) from exc
            if "quota" in err_msg or "rate limit" in err_msg or "429" in err_msg:
                raise AIProviderTemporaryError(
                    "Gemini quota exceeded.",
                    provider="gemini",
                    reason="quota exceeded / rate limit",
                ) from exc
            raise AIProviderTemporaryError(
                "Gemini request failed.",
                provider="gemini",
                reason=str(exc),
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected Gemini provider failure")
            raise AIProviderTemporaryError(
                "Unexpected Gemini provider failure.",
                provider="gemini",
                reason="unexpected failure",
            ) from exc
