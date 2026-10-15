"""
backend/services/embedding_service.py
======================================
Embedding generation service for ASTRA AI using sentence-transformers.
Provides 384-dimensional dense vectors compatible with Qdrant collection `astra_knowledge`.
Features:
- Lazy singleton model loading (all-MiniLM-L6-v2)
- In-memory embedding cache (MD5 based)
- Single and batch text embedding generation
- Input sanitization & validation
- Dimension verification (guaranteed 384 dimensions)
"""

import hashlib
import logging
from typing import List, Union

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
EXPECTED_EMBEDDING_DIM = 384

# Global singleton instance for cached model
_model_instance: SentenceTransformer | None = None
# Simple in-memory cache to avoid recomputing identical strings: {hash_key: [float, ...]}
_embedding_cache: dict[str, list[float]] = {}


def get_embedding_model(model_name: str = DEFAULT_MODEL_NAME) -> SentenceTransformer:
    """
    Get or initialize the cached SentenceTransformer model instance.
    Loads model lazily on first access.
    """
    global _model_instance
    if _model_instance is None:
        logger.info("Loading embedding model '%s'...", model_name)
        _model_instance = SentenceTransformer(model_name)
        logger.info("Embedding model '%s' loaded successfully.", model_name)
    return _model_instance


def _hash_text(text: str) -> str:
    """Generate MD5 hash key for caching text embeddings."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def generate_embedding(text: str, use_cache: bool = True) -> list[float]:
    """
    Generate a 384-dimensional dense embedding vector for a single text string.

    :param text: Input string to embed.
    :param use_cache: Whether to use and update the in-memory embedding cache.
    :return: A list of 384 float numbers representing the normalized vector.
    :raises ValueError: If input is not a valid non-empty string or output dimension mismatches.
    """
    if not isinstance(text, str):
        raise ValueError(f"Input text must be a string, got {type(text).__name__}.")

    sanitized = text.strip()
    if not sanitized:
        raise ValueError("Cannot generate embedding for empty or whitespace-only text.")

    cache_key = _hash_text(sanitized) if use_cache else ""
    if use_cache and cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    model = get_embedding_model()
    # normalize_embeddings=True gives unit vectors, perfect for Cosine distance in Qdrant
    vector = model.encode(sanitized, normalize_embeddings=True)
    vector_list = [float(x) for x in vector.tolist()]

    if len(vector_list) != EXPECTED_EMBEDDING_DIM:
        raise ValueError(
            f"Expected {EXPECTED_EMBEDDING_DIM}-dimensional vector, but model produced {len(vector_list)}."
        )

    if use_cache and cache_key:
        _embedding_cache[cache_key] = vector_list

    return vector_list


def generate_embeddings_batch(
    texts: list[str],
    batch_size: int = 32,
    use_cache: bool = True,
) -> list[list[float]]:
    """
    Generate 384-dimensional dense embedding vectors for a batch of text strings.

    :param texts: List of text strings.
    :param batch_size: Batch size for model encoding.
    :param use_cache: Whether to leverage and populate cache.
    :return: List of 384-dimensional float lists.
    :raises ValueError: If input is empty or contains non-string items.
    """
    if not isinstance(texts, list):
        raise ValueError(f"Input texts must be a list, got {type(texts).__name__}.")
    if not texts:
        return []

    results: list[list[float] | None] = [None] * len(texts)
    uncached_indices: list[int] = []
    uncached_texts: list[str] = []

    for i, t in enumerate(texts):
        if not isinstance(t, str):
            raise ValueError(f"Element at index {i} must be a string, got {type(t).__name__}.")
        sanitized = t.strip()
        if not sanitized:
            raise ValueError(f"Element at index {i} is empty or whitespace-only.")

        cache_key = _hash_text(sanitized) if use_cache else ""
        if use_cache and cache_key in _embedding_cache:
            results[i] = _embedding_cache[cache_key]
        else:
            uncached_indices.append(i)
            uncached_texts.append(sanitized)

    if uncached_texts:
        model = get_embedding_model()
        vectors = model.encode(
            uncached_texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        for idx, vec in zip(uncached_indices, vectors):
            vec_list = [float(x) for x in vec.tolist()]
            if len(vec_list) != EXPECTED_EMBEDDING_DIM:
                raise ValueError(
                    f"Expected {EXPECTED_EMBEDDING_DIM} dimensions, but got {len(vec_list)}."
                )
            results[idx] = vec_list
            if use_cache:
                sanitized_text = uncached_texts[uncached_indices.index(idx)]
                _embedding_cache[_hash_text(sanitized_text)] = vec_list

    return [r for r in results if r is not None]


def clear_embedding_cache() -> None:
    """Clear in-memory embedding cache."""
    global _embedding_cache
    _embedding_cache.clear()
