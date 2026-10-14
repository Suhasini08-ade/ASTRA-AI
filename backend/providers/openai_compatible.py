"""Shared implementation for configured OpenAI-compatible AI providers."""

import json
import logging
from typing import Any

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, OpenAIError

from backend.providers.base import (
    AIProviderConfigurationError,
    AIProviderRequestError,
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
    ToolCallItem,
)

logger = logging.getLogger(__name__)


class OpenAICompatibleProvider(BaseAIProvider):
    """OpenAI chat-completions adapter with safe, routable error classes."""

    provider_name = "AI provider"
    key_name = "API_KEY"
    model_name = "MODEL"

    def __init__(self, *, api_key: str, model: str, base_url: str) -> None:
        self._model = model
        self._client: AsyncOpenAI | None = (
            AsyncOpenAI(api_key=api_key, base_url=base_url) if api_key else None
        )

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> AIProviderResponse:
        prov_key = self.provider_name.lower()
        if not self._client:
            raise AIProviderConfigurationError(
                f"{self.provider_name} is not configured. Set {self.key_name} in backend/.env.",
                provider=prov_key,
                reason="missing API key",
            )
        if not self._model:
            raise AIProviderConfigurationError(
                f"{self.provider_name} model is not configured. Set {self.model_name} in backend/.env.",
                provider=prov_key,
                reason="missing model configuration",
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
            for tool_call in choice.tool_calls or []:
                try:
                    arguments = json.loads(tool_call.function.arguments or "{}")
                except json.JSONDecodeError:
                    arguments = {}
                tool_calls.append(
                    ToolCallItem(
                        id=tool_call.id,
                        name=tool_call.function.name,
                        arguments=arguments,
                    )
                )
            return AIProviderResponse(
                content=(choice.content or "").strip() if not tool_calls else None,
                tool_calls=tool_calls,
            )
        except APIStatusError as exc:
            status_code = exc.status_code
            logger.warning("%s request failed with status %s", self.provider_name, status_code)
            if status_code in {401, 403}:
                raise AIProviderConfigurationError(
                    f"{self.provider_name} configuration is invalid.",
                    provider=prov_key,
                    reason="invalid API key or authentication failure",
                    status_code=status_code,
                ) from exc
            if status_code == 404:
                raise AIProviderConfigurationError(
                    f"{self.provider_name} model unavailable.",
                    provider=prov_key,
                    reason="model unavailable",
                    status_code=status_code,
                ) from exc
            if status_code == 429:
                raise AIProviderTemporaryError(
                    f"{self.provider_name} rate limit or quota exceeded.",
                    provider=prov_key,
                    reason="quota exceeded / rate limit",
                    status_code=status_code,
                ) from exc
            if status_code in {408, 500, 502, 503, 504}:
                raise AIProviderTemporaryError(
                    f"{self.provider_name} service is temporarily unavailable.",
                    provider=prov_key,
                    reason="temporary service unavailable",
                    status_code=status_code,
                ) from exc
            raise AIProviderRequestError(
                f"{self.provider_name} request failed.",
                provider=prov_key,
                reason=f"status code {status_code}",
                status_code=status_code,
            ) from exc
        except (APIConnectionError, APITimeoutError) as exc:
            logger.warning("%s request could not reach the service", self.provider_name)
            raise AIProviderTemporaryError(
                f"{self.provider_name} connection timeout or network error.",
                provider=prov_key,
                reason="temporary service unavailable",
            ) from exc
        except OpenAIError as exc:
            logger.warning("%s request failed: %s", self.provider_name, exc)
            err_msg = str(exc).lower()
            if any(marker in err_msg for marker in ("invalid api key", "authentication", "unauthorized")):
                raise AIProviderConfigurationError(
                    f"{self.provider_name} configuration is invalid.",
                    provider=prov_key,
                    reason="invalid API key or authentication failure",
                ) from exc
            if any(marker in err_msg for marker in ("model_not_found", "does not exist", "not found")):
                raise AIProviderConfigurationError(
                    f"{self.provider_name} model unavailable.",
                    provider=prov_key,
                    reason="model unavailable",
                ) from exc
            if "quota" in err_msg or "rate limit" in err_msg or "429" in err_msg:
                raise AIProviderTemporaryError(
                    f"{self.provider_name} quota exceeded.",
                    provider=prov_key,
                    reason="quota exceeded / rate limit",
                ) from exc
            raise AIProviderTemporaryError(
                f"{self.provider_name} request failed.",
                provider=prov_key,
                reason=str(exc),
            ) from exc
        except Exception as exc:
            logger.error("Unexpected %s provider failure", self.provider_name)
            raise AIProviderTemporaryError(
                f"Unexpected {self.provider_name} failure.",
                provider=prov_key,
                reason="unexpected failure",
            ) from exc
