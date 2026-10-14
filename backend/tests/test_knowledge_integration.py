"""
tests/test_knowledge_integration.py
===================================
End-to-end integration and unit tests for Knowledge storage,
semantic search, document chunking, duplicate prevention, and user isolation.
"""

import asyncio
from datetime import datetime, timezone
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.services.knowledge_service import (
    KnowledgeService,
    chunk_text,
    compute_content_hash,
    generate_qdrant_point_id,
)


class FakeMongoCollection:
    """In-memory MongoDB collection simulation for testing."""

    def __init__(self):
        self.docs = []

    async def find_one(self, query):
        for d in self.docs:
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                return d
        return None

    async def insert_one(self, doc):
        from bson import ObjectId

        new_doc = dict(doc)
        new_doc["_id"] = ObjectId()
        self.docs.append(new_doc)
        mock_result = MagicMock()
        mock_result.inserted_id = new_doc["_id"]
        return mock_result

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                self.docs.pop(i)
                return MagicMock(deleted_count=1)
        return MagicMock(deleted_count=0)


class FakeMongoDB:
    def __init__(self):
        self.knowledge_items = FakeMongoCollection()
        self.documents = FakeMongoCollection()


class TestKnowledgeIntegration(unittest.TestCase):
    def setUp(self):
        self.fake_db = FakeMongoDB()
        self.mock_qdrant = MagicMock()
        self.service = KnowledgeService(qdrant_client=self.mock_qdrant, collection_name="test_knowledge")

    def test_chunking_utility(self):
        """Test text chunking and overlap logic."""
        sample = "Paragraph 1 is about AI.\n\nParagraph 2 covers Qdrant.\n\nParagraph 3 details vector embeddings."
        chunks = chunk_text(sample, chunk_size=50, overlap=10)
        self.assertGreaterEqual(len(chunks), 2)
        # Verify content was preserved
        recombined = " ".join(chunks)
        self.assertIn("AI", recombined)
        self.assertIn("Qdrant", recombined)

    def test_save_knowledge_item_with_deduplication(self):
        """Test knowledge saving, vector upsert, and duplicate prevention."""
        user_a = "user_alpha_123"
        text = "Meeting with product leadership on Q4 roadmap targets."

        # First save
        res1 = asyncio.run(
            self.service.save_knowledge_item(
                db=self.fake_db,
                user_id=user_a,
                text=text,
                title="Q4 Roadmap",
                category="work",
            )
        )
        self.assertEqual(res1["status"], "created")
        self.assertEqual(self.mock_qdrant.upsert.call_count, 1)

        # Duplicate save should detect existing hash and not call Qdrant again
        res2 = asyncio.run(
            self.service.save_knowledge_item(
                db=self.fake_db,
                user_id=user_a,
                text=text,
                title="Q4 Roadmap",
                category="work",
            )
        )
        self.assertEqual(res2["status"], "already_exists")
        self.assertEqual(self.mock_qdrant.upsert.call_count, 1)

    def test_user_isolation_in_storage_and_search(self):
        """Verify user A and user B cannot see or overwrite each other's data."""
        user_a = "user_alpha"
        user_b = "user_beta"
        text = "Secret project code name: Project Genesis."

        asyncio.run(
            self.service.save_knowledge_item(
                db=self.fake_db,
                user_id=user_a,
                text=text,
            )
        )

        # User B saves the exact same text - should create separate record under user_b
        res_b = asyncio.run(
            self.service.save_knowledge_item(
                db=self.fake_db,
                user_id=user_b,
                text=text,
            )
        )
        self.assertEqual(res_b["status"], "created")
        self.assertEqual(len(self.fake_db.knowledge_items.docs), 2)

        # Now test search filter construction enforces user_id
        mock_point = MagicMock()
        mock_point.id = "point-1"
        mock_point.score = 0.88
        mock_point.payload = {"text": text, "user_id": user_a, "title": "Secret"}
        self.mock_qdrant.query_points.return_value = MagicMock(points=[mock_point])

        results = asyncio.run(
            self.service.search_knowledge(user_id=user_a, query="Genesis project")
        )
        self.assertEqual(len(results), 1)

        # Check call arguments to query_points had correct user_id filter
        call_kwargs = self.mock_qdrant.query_points.call_args[1]
        must_filters = call_kwargs["query_filter"].must
        user_filter = next(f for f in must_filters if f.key == "user_id")
        self.assertEqual(user_filter.match.value, user_a)

    def test_document_ingestion_and_chunk_indexing(self):
        """Test full document chunking, batch embedding, and indexing."""
        user_id = "user_doc_tester"
        doc_content = (
            "Astra AI Architecture Overview.\n\n"
            "Section 1: Distributed multi-agent systems and providers.\n\n"
            "Section 2: High dimensional vector storage in Qdrant with cosine similarity.\n\n"
            "Section 3: Fast async document ingestion and chunk indexing pipeline."
        )

        res = asyncio.run(
            self.service.ingest_document(
                db=self.fake_db,
                user_id=user_id,
                text_content=doc_content,
                file_name="architecture.txt",
                file_type="text",
            )
        )
        self.assertEqual(res["status"], "indexed")
        self.assertGreater(res["chunks_count"], 0)
        self.assertEqual(len(self.fake_db.documents.docs), 1)


if __name__ == "__main__":
    unittest.main()
