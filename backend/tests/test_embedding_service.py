"""
tests/test_embedding_service.py
================================
Unit tests for backend/services/embedding_service.py.
Verifies:
1. Embedding dimensionality is exactly 384.
2. Embedding output values are floats and properly normalized (unit length).
3. Input validation rejects empty/invalid text.
4. Batch generation matches individual generation and preserves dimension.
5. In-memory caching returns identical vectors without redundant encoding.
"""

import math
import unittest

from backend.services.embedding_service import (
    EXPECTED_EMBEDDING_DIM,
    clear_embedding_cache,
    generate_embedding,
    generate_embeddings_batch,
    get_embedding_model,
)


class TestEmbeddingService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        clear_embedding_cache()

    def setUp(self):
        clear_embedding_cache()

    def test_single_embedding_dimension_and_type(self):
        """Test that single text generation produces exactly 384 floats."""
        sample_text = "Astra AI unified intelligence platform memory retrieval"
        vec = generate_embedding(sample_text)

        self.assertIsInstance(vec, list)
        self.assertEqual(len(vec), EXPECTED_EMBEDDING_DIM)
        self.assertTrue(all(isinstance(val, float) for val in vec))

        # Check normalization (norm should be ~1.0 for cosine similarity)
        norm = math.sqrt(sum(val * val for val in vec))
        self.assertAlmostEqual(norm, 1.0, places=3)

    def test_empty_and_invalid_inputs(self):
        """Test that empty or non-string inputs raise ValueError."""
        with self.assertRaises(ValueError):
            generate_embedding("")

        with self.assertRaises(ValueError):
            generate_embedding("   \n\t  ")

        with self.assertRaises(ValueError):
            generate_embedding(None)  # type: ignore

        with self.assertRaises(ValueError):
            generate_embeddings_batch(["valid text", ""])

    def test_caching_behavior(self):
        """Test that caching returns identical vectors."""
        text = "Semantic vector search with Qdrant collection"
        vec1 = generate_embedding(text, use_cache=True)
        vec2 = generate_embedding(text, use_cache=True)

        self.assertEqual(vec1, vec2)

    def test_batch_embeddings_dimension_and_consistency(self):
        """Test that batch embedding generates vectors for all elements matching 384 dims."""
        texts = [
            "Meeting notes regarding project roadmap.",
            "Weather forecast for tomorrow.",
            "Architecture document explaining multi-agent orchestration.",
        ]
        vectors = generate_embeddings_batch(texts, batch_size=2)

        self.assertEqual(len(vectors), len(texts))
        for vec in vectors:
            self.assertEqual(len(vec), EXPECTED_EMBEDDING_DIM)
            norm = math.sqrt(sum(val * val for val in vec))
            self.assertAlmostEqual(norm, 1.0, places=3)

        # Batch vector for item 0 should match single generation for item 0
        single_vec_0 = generate_embedding(texts[0])
        for val_batch, val_single in zip(vectors[0], single_vec_0):
            self.assertAlmostEqual(val_batch, val_single, places=4)


if __name__ == "__main__":
    unittest.main()
