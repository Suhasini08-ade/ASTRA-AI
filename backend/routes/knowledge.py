"""
routes/knowledge.py
===================
API routes for ASTRA AI private knowledge management & vector search.
Endpoints:
- POST /api/knowledge: Save knowledge item (direct text/note/memory)
- GET  /api/knowledge/search: Semantic similarity vector search with Qdrant
- POST /api/knowledge/ingest-document: Ingest & chunk document (PDF/DOCX/TXT)
- GET  /api/knowledge: List knowledge items and documents for the current user
- DELETE /api/knowledge/{item_id}: Delete a knowledge item
- DELETE /api/knowledge/documents/{doc_id}: Delete an ingested document and its vector chunks
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from backend.database import get_database
from backend.services.document_extractor import (
    DocumentExtractionError,
    extract_text_from_document,
)
from backend.services.knowledge_service import knowledge_service
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge"])


class KnowledgeCreateRequest(BaseModel):
    text: str = Field(..., min_length=1)
    title: Optional[str] = None
    category: str = Field(default="general")
    metadata: Optional[dict] = None


class DocumentIngestRequest(BaseModel):
    fileContent: str = Field(..., min_length=1)
    fileName: str = Field(default="document")
    fileType: str = Field(default="text")
    fileUrl: Optional[str] = None
    metadata: Optional[dict] = None
    reindex: bool = False


@router.get("/status")
async def get_knowledge_status():
    """Verify live Qdrant Cloud connection, collection configuration, and vector point count."""
    info = knowledge_service.get_collection_info()
    return success_response(data=info, message="Qdrant status fetched successfully.")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_knowledge(
    body: KnowledgeCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Save a text note or memory into Qdrant & MongoDB Atlas with user isolation."""
    user_id = str(current_user["_id"])
    try:
        saved = await knowledge_service.save_knowledge_item(
            db=db,
            user_id=user_id,
            text=body.text,
            title=body.title,
            category=body.category,
            metadata=body.metadata,
        )
        return success_response(data=saved, message="Knowledge item stored successfully.")
    except Exception as exc:
        logger.error("Failed to create knowledge item: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/search")
async def search_knowledge(
    q: str = Query(..., min_length=1, description="Semantic search query"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    limit: int = Query(5, ge=1, le=20, description="Max results"),
    score_threshold: float = Query(0.30, ge=0.0, le=1.0, description="Minimum similarity score"),
    current_user: dict = Depends(get_current_user),
):
    """Perform semantic vector search in Qdrant restricted strictly to the user's data."""
    user_id = str(current_user["_id"])
    try:
        hits = await knowledge_service.search_knowledge(
            user_id=user_id,
            query=q,
            category=category,
            limit=limit,
            score_threshold=score_threshold,
        )
        return success_response(data={"query": q, "results": hits, "count": len(hits)})
    except Exception as exc:
        logger.error("Failed during knowledge search: %s", exc)
        raise HTTPException(status_code=500, detail="Search failed.")


@router.post("/ingest-document")
async def ingest_document(
    body: DocumentIngestRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Ingest, extract, chunk, embed, and store a document (PDF, Word, or Text).
    Stores 384-dimensional dense vectors in Qdrant and reference record in MongoDB Atlas.
    """
    user_id = str(current_user["_id"])
    try:
        extracted = extract_text_from_document(
            content=body.fileContent,
            file_name=body.fileName,
            file_type=body.fileType,
            max_chars=None,
        )
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=400, detail=f"Text extraction failed: {exc.message}")

    try:
        ingest_res = await knowledge_service.ingest_document(
            db=db,
            user_id=user_id,
            text_content=extracted,
            file_name=body.fileName,
            file_type=body.fileType,
            file_url=body.fileUrl,
            metadata=body.metadata,
            reindex=body.reindex,
        )
        return success_response(data=ingest_res, message="Document indexed successfully into Qdrant.")
    except Exception as exc:
        logger.error("Document ingestion failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: str = Form("document"),
    reindex: bool = Form(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Direct multipart/form-data upload and ingestion for PDFs and documents.
    Extracts text, generates 384-d embeddings, and stores in Qdrant + MongoDB.
    """
    user_id = str(current_user["_id"])
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_name = file.filename or "uploaded_document"
    file_ext = (file_name.split(".")[-1] if "." in file_name else "pdf").lower()

    try:
        extracted = extract_text_from_document(
            content=file_bytes,
            file_name=file_name,
            file_type=file_ext,
            max_chars=None,
        )
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=400, detail=f"Text extraction failed: {exc.message}")

    try:
        ingest_res = await knowledge_service.ingest_document(
            db=db,
            user_id=user_id,
            text_content=extracted,
            file_name=file_name,
            file_type=file_ext,
            metadata={"title": title or file_name, "category": category},
            reindex=reindex,
        )
        return success_response(data=ingest_res, message="Document uploaded and indexed successfully.")
    except Exception as exc:
        logger.error("Document upload ingestion failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("")
async def list_knowledge(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
):
    """List stored knowledge items from MongoDB Atlas for the authenticated user."""
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}
    if category:
        query["category"] = category

    cursor = db.knowledge_items.find(query).sort("created_at", -1).limit(limit)
    items = []
    async for doc in cursor:
        items.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "category": doc.get("category", "general"),
            "text": doc.get("text", "")[:200] + ("..." if len(doc.get("text", "")) > 200 else ""),
            "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else None,
        })

    # Also fetch recent document summaries
    docs_cursor = db.documents.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    documents = []
    async for d in docs_cursor:
        documents.append({
            "id": str(d["_id"]),
            "file_name": d.get("file_name", ""),
            "file_type": d.get("file_type", ""),
            "chunks_count": d.get("chunks_count", 0),
            "character_count": d.get("character_count", 0),
            "content_hash": d.get("content_hash", ""),
            "summary": d.get("summary"),
            "text_preview": d.get("text_preview", ""),
            "status": "indexed",
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
        })

    return success_response(data={"knowledge_items": items, "documents": documents})


@router.delete("/{item_id}")
async def delete_knowledge_item(
    item_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete a knowledge item and its vector point."""
    user_id = str(current_user["_id"])
    success = await knowledge_service.delete_knowledge_item(db=db, user_id=user_id, item_id=item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Knowledge item not found.")
    return success_response(message="Knowledge item deleted successfully.")


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """Delete an ingested document and all its corresponding vector chunks."""
    user_id = str(current_user["_id"])
    success = await knowledge_service.delete_document(db=db, user_id=user_id, document_id=doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found.")
    return success_response(message="Document and vector chunks deleted successfully.")
