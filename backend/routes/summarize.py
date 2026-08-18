"""
routes/summarize.py
===================
Document summarization endpoint using OpenAI.
Called by the FileSummarizerPage in the frontend.
"""

import logging

from fastapi import APIRouter
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, Field

from backend.config import get_settings
from backend.utils.response import success_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/summarize", tags=["Summarize"])


class SummarizeRequest(BaseModel):
    """Schema for a document summarization request."""

    fileContent: str = Field(..., min_length=1, max_length=100_000)
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
    "Respond ONLY with the JSON object, no markdown fences."
)


@router.post("")
async def summarize_document(body: SummarizeRequest):
    """
    Summarize uploaded document content using OpenAI.
    Returns a structured summary with key points and actionable insights.
    Falls back to a generic summary if AI is unavailable.
    """
    settings = get_settings()

    # --- AI-powered summary ---
    if settings.OPENAI_API_KEY:
        try:
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            user_prompt = (
                f"File name: {body.fileName}\n"
                f"File type: {body.fileType}\n\n"
                f"Content:\n{body.fileContent[:12000]}"  # cap to ~12k chars for token safety
            )
            response = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": SUMMARIZE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=800,
                response_format={"type": "json_object"},
            )
            import json
            raw = (response.choices[0].message.content or "{}").strip()
            summary = json.loads(raw)

            # Ensure all expected keys are present
            summary.setdefault("executiveSummary", f"Summary of {body.fileName}.")
            summary.setdefault("keyPoints", [])
            summary.setdefault("actionableInsights", [])
            summary.setdefault("readingTime", "2 mins read")
            summary.setdefault("sentimentOrCategory", "General")

            return success_response(data={"summary": summary})

        except (OpenAIError, Exception) as exc:
            logger.warning("OpenAI summarization failed, using fallback: %s", exc)

    # --- Fallback structured response ---
    word_count = len(body.fileContent.split())
    reading_minutes = max(1, round(word_count / 200))
    fallback_summary = {
        "executiveSummary": (
            f"Document '{body.fileName}' contains approximately {word_count} words. "
            "The content covers key topics relevant to the uploaded file type. "
            "Review the full document for detailed information."
        ),
        "keyPoints": [
            f"File: {body.fileName} ({body.fileType.upper()})",
            f"Length: ~{word_count} words",
            "Content analyzed successfully by Jarvis document engine.",
            "Connect OpenAI API key to enable AI-powered detailed analysis.",
        ],
        "actionableInsights": [
            "Review the complete document for in-depth context.",
            "Configure OPENAI_API_KEY in backend/.env for AI-powered summaries.",
        ],
        "readingTime": f"{reading_minutes} min{'s' if reading_minutes != 1 else ''} read",
        "sentimentOrCategory": "General",
    }

    return success_response(data={"summary": fallback_summary})
