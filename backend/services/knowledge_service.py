"""
backend/services/knowledge_service.py
======================================
Comprehensive knowledge storage and semantic search service for ASTRA AI.
Integrates:
- MongoDB Atlas (authoritative store, metadata, document references)
- Qdrant Cloud (384-dimensional dense vectors in `astra_knowledge` collection)
- Sentence-Transformers embedding service (`all-MiniLM-L6-v2`)
- Strict `user_id` isolation and access control
- Duplicate prevention using content hashing (SHA-256)
- Text chunking for large documents/PDFs
- Safe CRUD operations (Create, Read, Semantic Search, Update, Delete)
"""

from datetime import datetime, timezone
import hashlib
import logging
import uuid
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from backend.config import get_settings
from backend.services.embedding_service import generate_embedding, generate_embeddings_batch
from backend.services.qdrant_service import get_qdrant_client

logger = logging.getLogger(__name__)

DEFAULT_COLLECTION = "astra_knowledge"
CHUNK_SIZE_CHARS = 1000
CHUNK_OVERLAP_CHARS = 150


def compute_content_hash(text: str) -> str:
    """Deterministic SHA-256 hash for deduplication and stable item tracking."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def generate_qdrant_point_id(user_id: str, unique_key: str) -> str:
    """Generate a stable, deterministic UUID for Qdrant point from user_id and content key."""
    namespace = uuid.NAMESPACE_DNS
    composite_key = f"{user_id}:{unique_key}"
    return str(uuid.uuid5(namespace, composite_key))


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE_CHARS,
    overlap: int = CHUNK_OVERLAP_CHARS,
) -> list[str]:
    """
    Split text into overlapping chunks, attempting to break on paragraph or sentence boundaries.
    """
    cleaned = text.strip()
    if not cleaned:
        return []

    if len(cleaned) <= chunk_size:
        return [cleaned]

    chunks: list[str] = []
    start = 0
    total_len = len(cleaned)

    while start < total_len:
        end = start + chunk_size
        if end >= total_len:
            chunk = cleaned[start:].strip()
            if chunk:
                chunks.append(chunk)
            break

        # Look for natural breaking points (. or \n) within the last 150 chars of the window
        split_pos = -1
        search_window = cleaned[max(start, end - 150) : end]
        last_newline = search_window.rfind("\n")
        last_period = search_window.rfind(". ")

        if last_newline != -1:
            split_pos = max(start, end - 150) + last_newline + 1
        elif last_period != -1:
            split_pos = max(start, end - 150) + last_period + 2

        if split_pos > start:
            chunk = cleaned[start:split_pos].strip()
            start = max(start + 1, split_pos - overlap)
        else:
            chunk = cleaned[start:end].strip()
            start = end - overlap

        if chunk:
            chunks.append(chunk)

    return chunks


class KnowledgeService:
    """
    Service managing multi-modal knowledge ingestion, storage, retrieval,
    and semantic search with Qdrant vector indexing and MongoDB Atlas persistence.
    """

    def __init__(
        self,
        qdrant_client: Optional[QdrantClient] = None,
        collection_name: Optional[str] = None,
    ) -> None:
        self.settings = get_settings()
        self.collection_name = collection_name or self.settings.QDRANT_COLLECTION or DEFAULT_COLLECTION
        self._qdrant = qdrant_client

    def _get_qdrant(self) -> QdrantClient:
        """Lazy Qdrant client retrieval."""
        if self._qdrant is None:
            self._qdrant = get_qdrant_client()
        return self._qdrant

    async def save_knowledge_item(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        text: str,
        title: Optional[str] = None,
        category: str = "general",
        metadata: Optional[dict[str, Any]] = None,
        source: str = "direct_entry",
        allow_duplicate: bool = False,
    ) -> dict[str, Any]:
        """
        Store a knowledge item in MongoDB and its 384-d vector embedding in Qdrant.
        Provides deduplication using content hash unless allow_duplicate=True.
        """
        if not user_id:
            raise ValueError("user_id is required for knowledge operations.")
        if not text or not text.strip():
            raise ValueError("Text content cannot be empty.")

        cleaned_text = text.strip()
        content_hash = compute_content_hash(cleaned_text)

        # Check for duplicate item for this user in MongoDB
        if not allow_duplicate:
            existing = await db.knowledge_items.find_one({
                "user_id": user_id,
                "content_hash": content_hash,
            })
            if existing:
                logger.info("Knowledge item already exists for user '%s'. Returning existing record.", user_id)
                return {
                    "id": str(existing["_id"]),
                    "qdrant_id": existing.get("qdrant_id"),
                    "title": existing.get("title", ""),
                    "category": existing.get("category", "general"),
                    "status": "already_exists",
                    "created_at": existing.get("created_at"),
                }

        point_id = generate_qdrant_point_id(user_id, content_hash)
        now = datetime.now(timezone.utc)
        meta = metadata or {}

        # 1. Generate 384-dimensional dense vector
        vector = generate_embedding(cleaned_text)

        # 2. Persist in Qdrant Cloud collection with strict user_id payload
        payload = {
            "user_id": user_id,
            "title": title or (cleaned_text[:60] + "..."),
            "category": category,
            "source": source,
            "text": cleaned_text,
            "content_hash": content_hash,
            "created_at": now.isoformat(),
            **meta,
        }

        try:
            client = self._get_qdrant()
            client.upsert(
                collection_name=self.collection_name,
                points=[
                    qmodels.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload,
                    )
                ],
            )
        except Exception as exc:
            logger.error("Failed to upsert vector in Qdrant: %s", exc)
            raise RuntimeError(f"Qdrant vector storage failed: {exc}")

        # 3. Persist authoritative record in MongoDB Atlas
        mongo_doc = {
            "user_id": user_id,
            "qdrant_id": point_id,
            "title": title or (cleaned_text[:60] + "..."),
            "category": category,
            "source": source,
            "text": cleaned_text,
            "content_hash": content_hash,
            "metadata": meta,
            "created_at": now,
            "updated_at": now,
        }
        res = await db.knowledge_items.insert_one(mongo_doc)

        return {
            "id": str(res.inserted_id),
            "qdrant_id": point_id,
            "title": mongo_doc["title"],
            "category": category,
            "status": "created",
            "created_at": now,
        }

    async def search_knowledge(
        self,
        user_id: str,
        query: str,
        category: Optional[str] = None,
        limit: int = 5,
        score_threshold: float = 0.35,
    ) -> list[dict[str, Any]]:
        """
        Perform semantic similarity search in Qdrant filtered strictly by `user_id`.

        :param user_id: Authenticated user ID (ensures data privacy).
        :param query: Natural language search query.
        :param category: Optional category filter (e.g., 'document', 'note', 'general').
        :param limit: Maximum number of relevant snippets to return.
        :param score_threshold: Minimum cosine similarity score.
        :return: List of matched items with text, score, and metadata.
        """
        if not user_id:
            raise ValueError("user_id is required for semantic search.")
        if not query or not query.strip():
            return []

        cleaned_query = query.strip()
        query_vector = generate_embedding(cleaned_query)

        # Build Qdrant filter condition ensuring user isolation
        must_conditions: list[Any] = [
            qmodels.FieldCondition(
                key="user_id",
                match=qmodels.MatchValue(value=user_id),
            )
        ]

        if category:
            must_conditions.append(
                qmodels.FieldCondition(
                    key="category",
                    match=qmodels.MatchValue(value=category),
                )
            )

        query_filter = qmodels.Filter(must=must_conditions)

        try:
            client = self._get_qdrant()
            search_results = client.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=query_filter,
                limit=limit,
                score_threshold=score_threshold,
                with_payload=True,
            )

            hits: list[dict[str, Any]] = []
            points = getattr(search_results, "points", search_results)
            for pt in points:
                payload = pt.payload or {}
                hits.append({
                    "id": str(pt.id),
                    "score": float(pt.score),
                    "text": payload.get("text", ""),
                    "title": payload.get("title", ""),
                    "category": payload.get("category", "general"),
                    "source": payload.get("source", ""),
                    "metadata": {k: v for k, v in payload.items() if k not in ["text", "user_id"]},
                })
            return hits
        except Exception as exc:
            logger.error("Error executing Qdrant semantic search: %s", exc)
            return []

    async def ingest_document(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        text_content: str,
        file_name: str,
        file_type: str = "document",
        file_url: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Ingest an entire document (e.g. PDF, Word, Markdown, or text) into knowledge base:
        1. Breaks document into overlapping chunks.
        2. Computes embeddings for all chunks in batch.
        3. Saves chunks to Qdrant with user_id and document reference.
        4. Saves document record and chunk references in MongoDB Atlas.
        """
        if not user_id:
            raise ValueError("user_id is required for document ingestion.")
        if not text_content or not text_content.strip():
            raise ValueError("Document text content is empty.")

        cleaned = text_content.strip()
        doc_hash = compute_content_hash(cleaned)
        chunks = chunk_text(cleaned)

        if not chunks:
            raise ValueError("Could not extract chunks from document.")

        now = datetime.now(timezone.utc)

        # Check if identical document was already ingested by this user
        existing_doc = await db.documents.find_one({
            "user_id": user_id,
            "content_hash": doc_hash,
        })
        if existing_doc:
            logger.info("Document '%s' already indexed for user %s.", file_name, user_id)
            return {
                "id": str(existing_doc["_id"]),
                "file_name": existing_doc.get("file_name", file_name),
                "chunks_count": existing_doc.get("chunks_count", len(chunks)),
                "status": "already_indexed",
            }

        # Batch embed all chunks
        chunk_embeddings = generate_embeddings_batch(chunks, batch_size=32)

        # Prepare Qdrant points
        points: list[qmodels.PointStruct] = []
        chunk_records: list[dict[str, Any]] = []

        for idx, (chunk_text_str, vec) in enumerate(zip(chunks, chunk_embeddings)):
            chunk_hash = compute_content_hash(chunk_text_str)
            point_id = generate_qdrant_point_id(user_id, f"{doc_hash}_{idx}")

            payload = {
                "user_id": user_id,
                "document_hash": doc_hash,
                "file_name": file_name,
                "file_type": file_type,
                "chunk_index": idx,
                "total_chunks": len(chunks),
                "text": chunk_text_str,
                "category": "document",
                "source": file_name,
                "created_at": now.isoformat(),
            }
            if metadata:
                payload.update(metadata)

            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vec,
                    payload=payload,
                )
            )
            chunk_records.append({
                "chunk_index": idx,
                "qdrant_id": point_id,
                "content_hash": chunk_hash,
                "text_snippet": chunk_text_str[:120],
            })

        # Upsert batch in Qdrant
        try:
            client = self._get_qdrant()
            client.upsert(
                collection_name=self.collection_name,
                points=points,
            )
        except Exception as exc:
            logger.error("Failed to index document chunks into Qdrant: %s", exc)
            raise RuntimeError(f"Qdrant document indexing failed: {exc}")

        # Store document record in MongoDB
        doc_record = {
            "user_id": user_id,
            "file_name": file_name,
            "file_type": file_type,
            "file_url": file_url,
            "content_hash": doc_hash,
            "character_count": len(cleaned),
            "chunks_count": len(chunks),
            "chunks": chunk_records,
            "metadata": metadata or {},
            "created_at": now,
            "updated_at": now,
        }
        inserted = await db.documents.insert_one(doc_record)

        return {
            "id": str(inserted.inserted_id),
            "file_name": file_name,
            "chunks_count": len(chunks),
            "status": "indexed",
        }

    async def delete_knowledge_item(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        item_id: str,
    ) -> bool:
        """
        Delete a knowledge item from both MongoDB Atlas and Qdrant.
        Validates ownership via user_id.
        """
        from bson import ObjectId

        query: dict[str, Any] = {"user_id": user_id}
        try:
            query["_id"] = ObjectId(item_id)
        except Exception:
            query["qdrant_id"] = item_id

        doc = await db.knowledge_items.find_one(query)
        if not doc:
            return False

        qdrant_id = doc.get("qdrant_id")
        if qdrant_id:
            try:
                client = self._get_qdrant()
                client.delete(
                    collection_name=self.collection_name,
                    points_selector=qmodels.PointIdsList(points=[qdrant_id]),
                )
            except Exception as exc:
                logger.warning("Failed to delete point %s from Qdrant: %s", qdrant_id, exc)

        await db.knowledge_items.delete_one({"_id": doc["_id"]})
        return True

    async def delete_document(
        self,
        db: AsyncIOMotorDatabase,
        user_id: str,
        document_id: str,
    ) -> bool:
        """
        Delete an ingested document and all its indexed chunks from Qdrant & MongoDB.
        """
        from bson import ObjectId

        try:
            doc = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": user_id})
        except Exception:
            return False

        if not doc:
            return False

        # Gather point IDs for all chunks
        point_ids = [c["qdrant_id"] for c in doc.get("chunks", []) if "qdrant_id" in c]
        if point_ids:
            try:
                client = self._get_qdrant()
                client.delete(
                    collection_name=self.collection_name,
                    points_selector=qmodels.PointIdsList(points=point_ids),
                )
            except Exception as exc:
                logger.warning("Failed to remove document chunks from Qdrant: %s", exc)

        await db.documents.delete_one({"_id": doc["_id"]})
        return True


# Singleton instance
knowledge_service = KnowledgeService()
