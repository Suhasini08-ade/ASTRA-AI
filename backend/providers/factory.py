"""
providers/factory.py
====================
Provider factory creating the configured primary/fallback provider router.
"""

import logging

from backend.config import get_settings
from backend.providers.base import AIProviderConfigurationError, BaseAIProvider
from backend.providers.gemini_provider import GeminiProvider
from backend.providers.groq_provider import GroqProvider
from backend.providers.openai_provider import OpenAIProvider
from backend.providers.openrouter_provider import OpenRouterProvider
from backend.providers.router import ProviderRouter

logger = logging.getLogger(__name__)


def _create_provider(provider_name: str) -> BaseAIProvider:
    """Create one explicitly named provider without making network calls."""
    normalized = provider_name.strip().lower()
    providers: dict[str, type[BaseAIProvider]] = {
        "gemini": GeminiProvider,
        "google": GeminiProvider,
        "groq": GroqProvider,
        "openrouter": OpenRouterProvider,
        "openai": OpenAIProvider,
        "gpt": OpenAIProvider,
    }
    provider_class = providers.get(normalized)
    if not provider_class:
        raise AIProviderConfigurationError(
            "AI provider configuration is invalid. Verify AI_PROVIDER_PRIMARY and AI_PROVIDER_FALLBACK in backend/.env."
        )
    return provider_class()


def get_provider_router() -> ProviderRouter:
    """Build a sequential provider router from explicitly configured environment values."""
    settings = get_settings()
    primary_name = (settings.AI_PROVIDER_PRIMARY or settings.AI_PROVIDER or "gemini").strip().lower()
    raw_fallbacks = (settings.AI_PROVIDER_FALLBACKS or getattr(settings, "AI_PROVIDER_FALLBACK", "") or "").strip().lower()

    configured_names: list[str] = [primary_name]
    if raw_fallbacks:
        for f_name in raw_fallbacks.split(","):
            cleaned = f_name.strip()
            if cleaned and cleaned not in configured_names:
                configured_names.append(cleaned)

    provider_chain: list[tuple[str, BaseAIProvider]] = []
    for name in configured_names:
        try:
            provider_instance = _create_provider(name)
            provider_chain.append((name, provider_instance))
        except AIProviderConfigurationError as exc:
            logger.warning("Skipping unknown provider '%s' in configuration: %s", name, exc)

    logger.info(
        "AI provider chain configured: %s",
        " -> ".join(name for name, _ in provider_chain),
    )
    return ProviderRouter(providers=provider_chain)


def get_ai_provider() -> BaseAIProvider:
    """Backward-compatible accessor returning the provider router."""
    return get_provider_router()
