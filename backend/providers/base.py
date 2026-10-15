"""
providers/base.py
=================
Abstract base class and standardized response data classes for AI Providers.
Allows the AI Agent & AI Service to switch LLM backends without direct provider coupling.
"""

from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel, Field


class AIProviderError(Exception):
    """A safe, provider-neutral error raised by an AI provider."""

    def __init__(
        self,
        message: str = "AI provider failure.",
        *,
        provider: str = "",
        retryable: bool = True,
        configuration_error: bool = False,
        status_code: int | None = None,
        reason: str = "",
    ) -> None:
        super().__init__(message)
        self.provider = provider
        self.retryable = retryable
        self.configuration_error = configuration_error
        self.status_code = status_code
        self.reason = reason or message

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "retryable": self.retryable,
            "reason": self.reason,
            "status_code": self.status_code,
        }


class AIProviderConfigurationError(AIProviderError):
    """A missing/invalid provider key or model. Allows fallback in multi-provider router."""

    def __init__(
        self,
        message: str = "AI provider configuration is invalid.",
        *,
        provider: str = "",
        reason: str = "configuration/model unavailable",
        status_code: int | None = None,
    ) -> None:
        super().__init__(
            message,
            provider=provider,
            retryable=True,
            configuration_error=True,
            status_code=status_code,
            reason=reason,
        )


class AIProviderTemporaryError(AIProviderError):
    """A transient provider failure that is eligible for configured fallback."""

    def __init__(
        self,
        message: str = "AI provider is temporarily unavailable.",
        *,
        provider: str = "",
        reason: str = "temporary service failure",
        status_code: int | None = None,
    ) -> None:
        super().__init__(
            message,
            provider=provider,
            retryable=True,
            status_code=status_code,
            reason=reason,
        )


class AIProviderRequestError(AIProviderError):
    """A non-retryable request failure."""

    def __init__(
        self,
        message: str = "AI request could not be completed.",
        *,
        provider: str = "",
        reason: str = "request failure",
        status_code: int | None = None,
    ) -> None:
        super().__init__(
            message,
            provider=provider,
            retryable=False,
            status_code=status_code,
            reason=reason,
        )


class ToolCallItem(BaseModel):
    """Standardized representation of a tool call request from an LLM."""
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class AIProviderResponse(BaseModel):
    """Standardized response object returned by any AI Provider."""
    content: str | None = None
    tool_calls: list[ToolCallItem] = Field(default_factory=list)


class BaseAIProvider(ABC):
    """Abstract interface for pluggable AI Providers (Gemini, OpenAI, Anthropic, etc.)."""

    @abstractmethod
    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | dict[str, Any] | None = None,
    ) -> AIProviderResponse:
        """
        Execute a chat completion turn with function/tool calling support.

        :param messages: Conversation history list of message dicts.
        :param tools: Standardized OpenAI-format JSON schema tool definitions.
        :param tool_choice: Specific tool choice mode ('auto', 'required', or specific tool).
        :return: Standardized AIProviderResponse.
        """
        pass

