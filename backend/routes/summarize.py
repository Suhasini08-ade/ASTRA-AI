"""
routes/summarize.py
===================
Document summarization endpoint utilizing the unified AI Provider Router.
Processes uploaded PDF, DOCX, and TXT documents, safely extracts text,
and generates structured summaries through Gemini -> Groq -> OpenRouter.
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.services.ai_service import AIService
from backend.services.document_extractor import (
    DocumentExtractionError,
    extract_text_from_document,
)
from backend.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/summarize", tags=["Summarize"])


class SummarizeRequest(BaseModel):
    """Schema for a document summarization request."""

    fileContent: str = Field(..., min_length=1, max_length=15_000_000)
    fileName: str = Field(default="document")
    fileType: str = Field(default="text")


SUMMARIZE_SYSTEM_PROMPT = (
    "You are an expert document analyst. "
    "Given the content of a file, produce a structured JSON analysis with these exact keys:\n"
    "- executiveSummary: a 2-3 sentence executive overview\n"
    "- keyPoints: a list of 3-6 bullet-point strings capturing the main ideas\n"
    "- actionableInsights: a list of 2-4 recommended next steps or action items\n"
    "- readingTime: estimated reading time (e.g. '3 mins read')\n"
    "- sentimentOrCategory: one-word category or sentiment (e.g. 'Productivity', 'Technical', 'Positive')\n"
    "Respond ONLY with the JSON object, no markdown fences or additional text."
)


def get_ai_service() -> AIService:
    """Dependency provider returning the configured AIService with ProviderRouter."""
    return AIService()


def _parse_summary_json(content: str) -> dict | None:
    """Safely parse structured JSON from model output, handling potential markdown fences."""
    if not content:
        return None

    cleaned = content.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        json_candidate = cleaned[start_idx : end_idx + 1]
        try:
            parsed = json.loads(json_candidate)
            if isinstance(parsed, dict) and "executiveSummary" in parsed:
                return parsed
        except Exception:
            pass

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "executiveSummary" in parsed:
            return parsed
    except Exception:
        pass

    return None


@router.post("")
async def summarize_document(
    body: SummarizeRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Summarize uploaded document content using the unified AI Provider Router.
    Converts PDF, DOCX, or TXT into sanitized text before AI processing.
    Falls back gracefully if AI providers are temporarily unavailable.
    """
    # 1. Safely extract plain text from document (never forward raw binary)
    try:
        extracted_text = extract_text_from_document(
            content=body.fileContent,
            file_name=body.fileName,
            file_type=body.fileType,
        )
    except DocumentExtractionError as exc:
        logger.warning("Document extraction failed for '%s': %s", body.fileName, exc.message)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to extract readable text: {exc.message}",
        )
    except Exception as exc:
        logger.error("Unexpected error extracting document '%s': %s", body.fileName, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to process document content.",
        )

    # 2. Invoke unified AI Service with ProviderRouter fallback
    user_prompt = (
        f"File name: {body.fileName}\n"
        f"File type: {body.fileType}\n\n"
        f"Document Content:\n{extracted_text}"
    )

    word_count = len(extracted_text.split())
    reading_minutes = max(1, round(word_count / 200))

    try:
        ai_response = await ai_service.generate(
            messages=[
                {"role": "system", "content": SUMMARIZE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ]
        )

        if ai_response and ai_response.content:
            summary = _parse_summary_json(ai_response.content)
            if summary:
                summary.setdefault("executiveSummary", f"Summary of {body.fileName}.")
                summary.setdefault("keyPoints", [])
                summary.setdefault("actionableInsights", [])
                summary.setdefault(
                    "readingTime", f"{reading_minutes} min{'s' if reading_minutes != 1 else ''} read"
                )
                summary.setdefault("sentimentOrCategory", "General")
                return success_response(data={"summary": summary})
    except Exception as exc:
        logger.warning("AI generation encountered error during summarization: %s", exc)

    # 3. Fallback structured response if AI provider is temporarily unavailable
    fallback_summary = {
        "executiveSummary": (
            f"Document '{body.fileName}' contains approximately {word_count} words. "
            "The content covers key topics relevant to the uploaded document. "
            "Review the full document for detailed information."
        ),
        "keyPoints": [
            f"File: {body.fileName} ({body.fileType.upper()})",
            f"Length: ~{word_count} words analyzed",
            "Content extracted and sanitized successfully by Astra document engine.",
            "Configure GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY for live AI analysis.",
        ],
        "actionableInsights": [
            "Review the complete document for in-depth context.",
            "Verify AI provider credentials in backend/.env to activate live summarization.",
        ],
        "readingTime": f"{reading_minutes} min{'s' if reading_minutes != 1 else ''} read",
        "sentimentOrCategory": "General",
    }

    return success_response(data={"summary": fallback_summary})
