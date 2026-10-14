"""
providers/openai_provider.py
=============================
OpenAI AI Provider implementation of BaseAIProvider.
"""

import json
import logging
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, OpenAIError

from backend.config import get_settings
from backend.providers.base import AIProviderConfigurationError, AIProviderRequestError, AIProviderResponse, AIProviderTemporaryError, BaseAIProvider, ToolCallItem

logger = logging.getLogger(__name__)


class OpenAIProvider(BaseAIProvider):
    """OpenAI API implementation supporting function calling and chat completions."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        key = api_key or settings.OPENAI_API_KEY
        self._model = model or settings.OPENAI_MODEL
        self._client: AsyncOpenAI | None = AsyncOpenAI(api_key=key) if key else None

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AIProviderResponse:
        if not self._client:
            raise AIProviderConfigurationError(
                "OpenAI is not configured. Set OPENAI_API_KEY in backend/.env."
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
            logger.warning("OpenAI request failed with status %s", status_code)
            if status_code in {401, 403, 404}:
                raise AIProviderConfigurationError(
                    "OpenAI configuration is invalid. Verify OPENAI_API_KEY and OPENAI_MODEL in backend/.env.",
                    status_code=status_code,
                ) from exc
            if status_code in {408, 429, 500, 502, 503, 504}:
                raise AIProviderTemporaryError(status_code=status_code) from exc
            raise AIProviderRequestError(status_code=status_code) from exc
        except (APIConnectionError, APITimeoutError) as exc:
            logger.warning("OpenAI request could not reach the service")
            raise AIProviderTemporaryError() from exc
        except OpenAIError as exc:
            logger.warning("OpenAI request failed")
            err_msg = str(exc).lower()
            if any(marker in err_msg for marker in ("invalid api key", "authentication", "model_not_found", "does not exist")):
                raise AIProviderConfigurationError(
                    "OpenAI configuration is invalid. Verify OPENAI_API_KEY and OPENAI_MODEL in backend/.env."
                ) from exc
            raise AIProviderTemporaryError() from exc
        except Exception as exc:
            logger.error("Unexpected OpenAI provider failure")
            raise AIProviderTemporaryError() from exc
