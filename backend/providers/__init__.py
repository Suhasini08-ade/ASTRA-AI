"""
providers package
=================
Pluggable AI Providers architecture for Jarvis AI Agent.
"""

from backend.providers.base import (
    AIProviderConfigurationError,
    AIProviderError,
    AIProviderRequestError,
    AIProviderResponse,
    AIProviderTemporaryError,
    BaseAIProvider,
    ToolCallItem,
)
from backend.providers.factory import get_ai_provider, get_provider_router
from backend.providers.gemini_provider import GeminiProvider
from backend.providers.groq_provider import GroqProvider
from backend.providers.openai_provider import OpenAIProvider
from backend.providers.openrouter_provider import OpenRouterProvider
from backend.providers.router import ProviderRouter

__all__ = [
    "BaseAIProvider",
    "AIProviderError",
    "AIProviderResponse",
    "AIProviderConfigurationError",
    "AIProviderRequestError",
    "AIProviderTemporaryError",
    "ToolCallItem",
    "get_ai_provider",
    "get_provider_router",
    "GeminiProvider",
    "GroqProvider",
    "OpenRouterProvider",
    "OpenAIProvider",
    "ProviderRouter",
]
