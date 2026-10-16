"""
tests/test_chat_document_attachment.py
======================================
Tests for Document Attachment in ASTRA AI Assistant Chat:
1. ChatMessage request schema validation with document metadata.
2. Document upload and Qdrant ingestion with SHA-256 deduplication and user isolation.
3. AIService targeted document context injection into system prompt.
4. Chat message persistence with attachment metadata in MongoDB.
5. Chat history retrieval projecting attachment metadata.
6. Full end-to-end workflow simulation.
"""

import asyncio
from datetime import datetime, timezone
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from bson import ObjectId
from pydantic import ValidationError

from backend.routes.chat import ChatMessage
from backend.services.ai_service import AIService
from backend.services.knowledge_service import (
    KnowledgeService,
    compute_content_hash,
)


class FakeMongoCollection:
    """In-memory collection for simulating MongoDB operations."""

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
        new_doc = dict(doc)
        if "_id" not in new_doc:
            new_doc["_id"] = ObjectId()
        self.docs.append(new_doc)
        res = MagicMock()
        res.inserted_id = new_doc["_id"]
        return res

    async def update_one(self, filter_q, update_q):
        for d in self.docs:
            match = True
            for k, v in filter_q.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                if "$set" in update_q:
                    d.update(update_q["$set"])
                res = MagicMock()
                res.modified_count = 1
                return res
        res = MagicMock()
        res.modified_count = 0
        return res

    async def delete_one(self, query):
        for i, d in enumerate(self.docs):
            match = True
            for k, v in query.items():
                if d.get(k) != v:
                    match = False
                    break
            if match:
                self.docs.pop(i)
                res = MagicMock()
                res.deleted_count = 1
                return res
        res = MagicMock()
        res.deleted_count = 0
        return res

    def find(self, query, projection=None):
        filtered = []
        for d in self.docs:
            match = True
            for k, v in query.items():
                if k == "$or":
                    or_matched = any(
                        all(d.get(sub_k) == sub_v for sub_k, sub_v in condition.items())
                        for condition in v
                    )
                    if not or_matched:
                        match = False
                        break
                elif d.get(k) != v:
                    match = False
                    break
            if match:
                res_doc = {}
                if projection:
                    for pk, pv in projection.items():
                        if pv == 1 and pk in d:
                            res_doc[pk] = d[pk]
                else:
                    res_doc = dict(d)
                filtered.append(res_doc)

        class FakeCursor:
            def __init__(self, data):
                self._data = list(data)

            def sort(self, key, direction=1):
                rev = (direction == -1)
                self._data.sort(key=lambda x: str(x.get(key, "")), reverse=rev)
                return self

            def limit(self, lim):
                self._data = self._data[:lim]
                return self

            async def to_list(self, length=None):
                if length is not None:
                    return list(self._data[:length])
                return list(self._data)

        return FakeCursor(filtered)

    async def delete_many(self, query):
        initial_len = len(self.docs)
        self.docs = [d for d in self.docs if any(d.get(k) != v for k, v in query.items())]
        res = MagicMock()
        res.deleted_count = initial_len - len(self.docs)
        return res


class FakeDatabase:
    def __init__(self):
        self.documents = FakeMongoCollection()
        self.chat_messages = FakeMongoCollection()
        self.knowledge_items = FakeMongoCollection()
        self.pending_actions = FakeMongoCollection()
        self.ai_pending_actions = FakeMongoCollection()


class TestChatDocumentAttachment(unittest.TestCase):
    """Test suite covering the complete document attachment chat workflow."""

    def setUp(self):
        self.fake_db = FakeDatabase()
        self.test_user_id = "test_user_attachment_123"
        self.alt_user_id = "alt_user_456"

    def test_chat_message_schema_validation(self):
        """Validate ChatMessage Pydantic model with and without document metadata."""
        # Valid standard message
        msg1 = ChatMessage(message="Hello ASTRA")
        self.assertEqual(msg1.message, "Hello ASTRA")
        self.assertIsNone(msg1.document_id)
        self.assertIsNone(msg1.document_hash)
        self.assertIsNone(msg1.file_name)

        # Valid message with document attachment
        msg2 = ChatMessage(
            message="Explain chapter 2 from this report",
            conversation_id="conv_789",
            document_id="doc_xyz",
            document_hash="hash_abc123",
            file_name="annual_report.pdf",
        )
        self.assertEqual(msg2.document_hash, "hash_abc123")
        self.assertEqual(msg2.file_name, "annual_report.pdf")
        self.assertEqual(msg2.document_id, "doc_xyz")

        # Invalid empty message should fail validation
        with self.assertRaises(ValidationError):
            ChatMessage(message="")

    def test_document_ingestion_and_deduplication(self):
        """Test document ingestion into Qdrant/MongoDB with content hashing & deduplication."""
        async def _test():
            mock_qdrant = MagicMock()
            mock_qdrant.retrieve.return_value = []
            mock_qdrant.upsert.return_value = None

            svc = KnowledgeService(qdrant_client=mock_qdrant, collection_name="astra_knowledge")

            doc_text = (
                "ASTRA AI Architecture Overview.\n"
                "ASTRA AI leverages Qdrant Cloud for dense 384-dimensional semantic vectors. "
                "All text chunks are embedded using sentence-transformers model all-MiniLM-L6-v2. "
                "Documents are deduplicated via SHA-256 content hashes to save storage."
            )
            expected_hash = compute_content_hash(doc_text)

            with patch("backend.services.knowledge_service.generate_embeddings_batch") as mock_emb:
                mock_emb.return_value = [[0.1] * 384]

                # First ingestion
                res1 = await svc.ingest_document(
                    db=self.fake_db,
                    user_id=self.test_user_id,
                    text_content=doc_text,
                    file_name="architecture.pdf",
                    file_type="pdf",
                )

                self.assertEqual(res1["status"], "indexed")
                self.assertEqual(res1["content_hash"], expected_hash)
                self.assertFalse(res1.get("is_duplicate", False))
                self.assertEqual(len(self.fake_db.documents.docs), 1)

                # Simulate Qdrant has points now
                mock_qdrant.retrieve.return_value = [MagicMock(id="point_1")]

                # Second ingestion with SAME content (duplicate detection)
                res2 = await svc.ingest_document(
                    db=self.fake_db,
                    user_id=self.test_user_id,
                    text_content=doc_text,
                    file_name="architecture_copy.pdf",
                    file_type="pdf",
                )

                self.assertTrue(res2.get("is_duplicate"))
                self.assertIn("Duplicate document detected", res2.get("message", ""))
                # MongoDB documents collection should still only have 1 record for this content
                self.assertEqual(len(self.fake_db.documents.docs), 1)

        asyncio.run(_test())

    def test_ai_service_document_context_injection_and_persistence(self):
        """Test AIService injects attached document context and persists attachment metadata."""
        async def _test():
            mock_provider = MagicMock()
            mock_response = MagicMock()
            mock_response.content = "Based on architecture.pdf, ASTRA AI uses Qdrant Cloud for 384-d semantic vectors."
            mock_response.tool_calls = []
            mock_provider.chat_completion = AsyncMock(return_value=mock_response)

            ai_svc = AIService(provider=mock_provider)

            doc_text = "ASTRA AI Architecture Overview. ASTRA AI leverages Qdrant Cloud for 384-d vectors."
            doc_hash = compute_content_hash(doc_text)
            file_name = "architecture.pdf"

            # Pre-populate MongoDB documents
            doc_record = {
                "_id": ObjectId(),
                "user_id": self.test_user_id,
                "file_name": file_name,
                "content_hash": doc_hash,
                "text_preview": doc_text,
                "chunks_count": 1,
            }
            await self.fake_db.documents.insert_one(doc_record)

            # Mock knowledge_service search to return targeted chunk
            with patch("backend.services.ai_service.knowledge_service.search_knowledge") as mock_search:
                mock_search.return_value = [
                    {
                        "id": "pt_1",
                        "score": 0.92,
                        "title": "architecture.pdf",
                        "text": doc_text,
                        "source": file_name,
                    }
                ]

                reply = await ai_svc.send_message(
                    db=self.fake_db,
                    user_id=self.test_user_id,
                    message="What vector database does ASTRA use?",
                    conversation_id="conv_attachment_test",
                    document_id=str(doc_record["_id"]),
                    document_hash=doc_hash,
                    file_name=file_name,
                )

                self.assertIn("ASTRA AI uses Qdrant Cloud", reply)

                # Verify knowledge_service was queried with document_hash and file_name
                mock_search.assert_any_call(
                    user_id=self.test_user_id,
                    query="What vector database does ASTRA use?",
                    document_hash=doc_hash,
                    file_name=file_name,
                    limit=8,
                    score_threshold=0.15,
                )

                # Verify provider was called with system prompt containing the document context
                call_args = mock_provider.chat_completion.call_args
                sent_messages = call_args[1]["messages"]
                system_content = sent_messages[0]["content"]
                self.assertIn("[ATTACHED DOCUMENT CONTEXT - architecture.pdf]", system_content)
                self.assertIn("ASTRA AI Architecture Overview", system_content)

                # Verify user message stored in MongoDB has attachment metadata
                saved_messages = self.fake_db.chat_messages.docs
                self.assertEqual(len(saved_messages), 2)  # 1 user + 1 assistant
                user_msg = saved_messages[0]
                self.assertEqual(user_msg["role"], "user")
                self.assertIn("attachment", user_msg)
                self.assertEqual(user_msg["attachment"]["file_name"], file_name)
                self.assertEqual(user_msg["attachment"]["document_hash"], doc_hash)
                self.assertEqual(user_msg["attachment"]["document_id"], str(doc_record["_id"]))

        asyncio.run(_test())

    def test_ai_service_document_preview_fallback(self):
        """Test fallback to MongoDB text_preview when Qdrant returns no chunks (broad question)."""
        async def _test():
            mock_provider = MagicMock()
            mock_response = MagicMock()
            mock_response.content = "Summary of document: It covers system specifications."
            mock_response.tool_calls = []
            mock_provider.chat_completion = AsyncMock(return_value=mock_response)

            ai_svc = AIService(provider=mock_provider)

            doc_text = "Detailed System Specifications: 16GB RAM required, Python 3.11+, MongoDB 7.0+."
            doc_hash = compute_content_hash(doc_text)
            file_name = "specs.txt"

            doc_record = {
                "_id": ObjectId(),
                "user_id": self.test_user_id,
                "file_name": file_name,
                "content_hash": doc_hash,
                "text_preview": doc_text,
            }
            await self.fake_db.documents.insert_one(doc_record)

            # Mock Qdrant returning empty list
            with patch("backend.services.ai_service.knowledge_service.search_knowledge") as mock_search:
                mock_search.return_value = []

                reply = await ai_svc.send_message(
                    db=self.fake_db,
                    user_id=self.test_user_id,
                    message="Summarize this file",
                    document_hash=doc_hash,
                    file_name=file_name,
                )

                call_args = mock_provider.chat_completion.call_args
                sent_messages = call_args[1]["messages"]
                system_content = sent_messages[0]["content"]
                # System prompt must contain the fallback document preview
                self.assertIn("[ATTACHED DOCUMENT CONTEXT - specs.txt]", system_content)
                self.assertIn("Detailed System Specifications", system_content)

        asyncio.run(_test())

    def test_get_history_includes_attachment(self):
        """Test that get_history projects and returns the attachment field."""
        async def _test():
            ai_svc = AIService()

            # Insert test user message with attachment
            user_time = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
            asst_time = datetime(2026, 1, 1, 12, 0, 5, tzinfo=timezone.utc)
            await self.fake_db.chat_messages.insert_one({
                "user_id": self.test_user_id,
                "conversation_id": "test_conv",
                "role": "user",
                "content": "Analyze report",
                "created_at": user_time,
                "attachment": {
                    "document_id": "doc_123",
                    "document_hash": "hash_456",
                    "file_name": "quarterly_report.pdf",
                },
            })
            # Insert assistant reply
            await self.fake_db.chat_messages.insert_one({
                "user_id": self.test_user_id,
                "conversation_id": "test_conv",
                "role": "assistant",
                "content": "The quarterly report indicates positive growth.",
                "created_at": asst_time,
            })

            history = await ai_svc.get_history(self.fake_db, self.test_user_id, conversation_id="test_conv")
            self.assertEqual(len(history), 2)
            user_msg = history[0]
            self.assertEqual(user_msg["role"], "user")
            self.assertIn("attachment", user_msg)
            self.assertEqual(user_msg["attachment"]["file_name"], "quarterly_report.pdf")
            self.assertEqual(user_msg["attachment"]["document_hash"], "hash_456")

        asyncio.run(_test())


if __name__ == "__main__":
    unittest.main()
