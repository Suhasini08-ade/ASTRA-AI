"""Authenticated Deep Dive knowledge-map workspace endpoints."""
from datetime import datetime, timezone
import ast
import json
import logging
import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from backend.database import get_database
from backend.providers import AIProviderError
from backend.services.ai_service import ai_service
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

router = APIRouter(prefix="/api/deep-dives", tags=["Deep Dive"])
logger = logging.getLogger(__name__)


class CreateSession(BaseModel):
    # Topics may be short labels (for example, "AI") or full natural-language
    # questions. The exact trimmed value is forwarded to the provider router.
    topic: str = Field(..., min_length=1, max_length=2000)


class SessionUpdate(BaseModel):
    selected_concept: str | None = Field(default=None, max_length=160)
    explored_concepts: list[str] | None = None
    confusion: dict[str, int] | None = None
    challenge_history: list[dict] | None = None
    knowledge_map: dict | None = None


class AIRequest(BaseModel):
    concept: str = Field(..., min_length=1, max_length=160)
    action: str = Field(..., pattern="^(explain|example|compare|question|challenge)$")
    prompt: str | None = Field(default=None, max_length=1500)
    related_concepts: list[str] = Field(default_factory=list)


def serialize(doc: dict) -> dict:
    result = {**doc, "id": str(result_id) if (result_id := doc.get("_id")) else None}
    result.pop("_id", None)
    return result


def clean_json(text: str) -> dict:
    """Extract JSON from the common code-fence / prose wrappers AI models emit."""
    text = text.strip()
    text = re.sub(r"```(?:json|javascript)?", "", text, flags=re.I).replace("```", "").strip()
    decoder = json.JSONDecoder()
    parsed = None

    # raw_decode stops exactly after the first valid JSON value, so prose or a
    # second explanation after the object cannot corrupt the payload.
    for marker in ("{", "["):
        start = text.find(marker)
        if start < 0:
            continue
        try:
            parsed, _ = decoder.raw_decode(text[start:])
            break
        except json.JSONDecodeError:
            continue

    if parsed is None:
        object_start, object_end = text.find("{"), text.rfind("}")
        list_start, list_end = text.find("["), text.rfind("]")
        if object_start < 0 and list_start < 0:
            raise ValueError("AI did not return JSON")
        if object_start >= 0 and (list_start < 0 or object_start < list_start):
            candidate = text[object_start:object_end + 1]
        else:
            candidate = text[list_start:list_end + 1]
        # Some compatible models use Python-style quoted dicts despite the prompt.
        parsed = ast.literal_eval(candidate)

    if not isinstance(parsed, (dict, list)):
        raise ValueError("AI did not return JSON")
    return {"nodes": parsed} if isinstance(parsed, list) else parsed


def map_from_concept_list(text: str, topic: str) -> list[dict]:
    """Use an AI-produced numbered/bulleted concept list when JSON is unavailable."""
    labels: list[str] = []
    for raw_line in text.splitlines():
        match = re.match(r"^\s*(?:[-*•]|\d+[.)])\s*(?:\*{0,2})?(.+?)\*{0,2}\s*$", raw_line)
        if not match:
            continue
        label = re.sub(r"^[A-Za-z ]{0,20}:\s*", "", match.group(1)).strip(" .:-")
        if 2 <= len(label) <= 80 and label.lower() != topic.lower() and label not in labels:
            labels.append(label)

    if len(labels) < 2:
        return []
    return [{"id": "root", "label": topic, "parent": None, "difficulty": "Beginner", "summary": f"A guided map of {topic}."}] + [
        {
            "id": re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or f"concept-{index}",
            "label": label,
            "parent": "root",
            "difficulty": "Beginner",
            "summary": f"Explore {label} as part of {topic}.",
        }
        for index, label in enumerate(labels[:8], start=1)
    ]


def normalize_map_nodes(nodes: list, topic: str) -> list[dict]:
    """Make arbitrary provider output a small, connected, renderable tree."""
    root = {
        "id": "root",
        "label": topic,
        "parent": None,
        "difficulty": "Beginner",
        "summary": f"Explore {topic} through its key ideas.",
    }
    normalized = [root]
    ids = {"root"}
    original_ids: dict[str, str] = {}

    # Keep the map scannable. The provider decides the concepts; this simply
    # puts an upper bound on visual density and makes unique safe identifiers.
    for index, node in enumerate(nodes[:14]):
        if not isinstance(node, dict):
            continue
        label = str(node.get("label") or node.get("name") or "").strip()
        if not label or label.lower() == topic.lower():
            continue
        original_id = str(node.get("id") or f"concept-{index}")
        safe_id = re.sub(r"[^a-z0-9]+", "-", original_id.lower()).strip("-") or f"concept-{index}"
        base_id = safe_id
        suffix = 2
        while safe_id in ids:
            safe_id = f"{base_id}-{suffix}"
            suffix += 1
        ids.add(safe_id)
        original_ids[original_id] = safe_id
        normalized.append({
            "id": safe_id,
            "label": label[:60],
            "parent": node.get("parent"),
            "difficulty": str(node.get("difficulty") or "Beginner"),
            "summary": str(node.get("summary") or node.get("description") or f"Explore {label}.")[:220],
        })

    valid_ids = {node["id"] for node in normalized}
    for node in normalized[1:]:
        parent = str(node.get("parent") or "root")
        parent = original_ids.get(parent, parent)
        # No detached nodes, self-references, or accidental roots.
        node["parent"] = parent if parent in valid_ids and parent != node["id"] else "root"

    # A visual mind map should stay shallow. Nodes deeper than two levels are
    # promoted to a direct branch rather than making the workspace crowded.
    by_id = {node["id"]: node for node in normalized}
    for node in normalized[1:]:
        cursor = node
        seen = {node["id"]}
        depth = 0
        while cursor.get("parent") and cursor["parent"] in by_id:
            parent = by_id[cursor["parent"]]
            if parent["id"] in seen:
                node["parent"] = "root"
                break
            seen.add(parent["id"])
            depth += 1
            if depth > 2:
                node["parent"] = "root"
                break
            cursor = parent
    return normalized


async def ai_json(prompt: str) -> dict:
    messages = [
        {"role": "system", "content": "You are ASTRA's learning-map engine. Return valid JSON only. Never use markdown."},
        {"role": "user", "content": prompt},
    ]
    try:
        # Use the already configured ASTRA provider router directly. The generic
        # chat helper intentionally replaces provider errors with prose, which
        # is useful for chat but cannot be parsed as Deep Dive's structured data.
        response = await ai_service._provider.chat_completion(messages=messages)
    except AIProviderError as exc:
        logger.warning("Deep Dive provider request failed: %s", exc.reason)
        raise HTTPException(
            status_code=503,
            detail="Deep Dive AI is temporarily unavailable. Please try again shortly.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected Deep Dive provider request failure")
        raise HTTPException(
            status_code=503,
            detail="Deep Dive AI is temporarily unavailable. Please try again shortly.",
        ) from exc
    content = (response.content or "").strip()
    if not content:
        raise HTTPException(status_code=502, detail="Deep Dive AI returned an empty response. Please retry.")
    try:
        return clean_json(content)
    except (ValueError, SyntaxError, json.JSONDecodeError):
        # Repair once through the same provider router rather than rejecting a
        # useful response simply because a provider included prose or malformed JSON.
        repair_messages = [
            {"role": "system", "content": "Return valid JSON only. Do not add markdown or commentary."},
            {"role": "user", "content": f"Convert this response into valid JSON matching the requested structure:\n{content}"},
        ]
        try:
            repair = await ai_service._provider.chat_completion(messages=repair_messages)
        except AIProviderError as exc:
            logger.warning("Deep Dive JSON repair request failed: %s", exc.reason)
            raise HTTPException(status_code=503, detail="Deep Dive AI is temporarily unavailable. Please try again shortly.") from exc
        try:
            return clean_json((repair.content or "").strip())
        except (ValueError, SyntaxError, json.JSONDecodeError):
            raise HTTPException(status_code=502, detail="Astra could not format the learning map. Please retry.")


@router.get("")
async def list_sessions(current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    docs = await db.deep_dives.find({"user_id": current_user["_id"]}).sort("updated_at", -1).limit(12).to_list(12)
    return success_response(data=[serialize(doc) for doc in docs])


@router.get("/{session_id}")
async def get_session(session_id: str, current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid Deep Dive session ID.")
    doc = await db.deep_dives.find_one({"_id": ObjectId(session_id), "user_id": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Deep Dive session not found.")
    return success_response(data=serialize(doc))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(body: CreateSession, current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    topic = body.topic.strip()
    try:
        map_data = await ai_json(
            f'''Create a compact, topic-specific mind map for this exact user search: "{topic}".
Return ONLY valid JSON with this exact shape: {{"nodes":[{{"id":"root","label":"{topic}","parent":null,"difficulty":"Beginner","summary":"short"}},{{"id":"slug","label":"Short branch","parent":"root","difficulty":"Beginner|Intermediate|Advanced","summary":"short"}}]}}.
The root label must exactly match the user's search. For a question, infer its core subject when choosing branches, but preserve the full question as the root label. Choose 3-6 branch categories specifically relevant to this topic; never reuse generic categories just because they suit another topic. Add 0-2 concise child nodes per branch only when they improve understanding. Use a maximum of 14 non-root nodes, a maximum depth of 2, meaningful labels under 60 characters, unique lowercase slug IDs, and no duplicate concepts. Do not write paragraphs.'''
        )
    except HTTPException as exc:
        # Keep provider failure explicit. A plain-text answer is handled below
        # only when it contains an actual AI-produced concept list.
        if exc.status_code != 502:
            raise
        try:
            response = await ai_service._provider.chat_completion(messages=[
                {"role": "system", "content": "List learning concepts only; one concept per bullet."},
                {"role": "user", "content": f"List 6-8 key concepts for learning {topic}."},
            ])
        except AIProviderError as provider_error:
            logger.warning("Deep Dive concept-list fallback failed: %s", provider_error.reason)
            raise exc from provider_error
        generated_nodes = map_from_concept_list((response.content or "").strip(), topic)
        if not generated_nodes:
            raise exc
        map_data = {"nodes": generated_nodes}
    nodes = map_data.get("nodes") if isinstance(map_data, dict) else None
    if not isinstance(nodes, list) or len(nodes) < 2:
        raise HTTPException(status_code=502, detail="Astra generated an incomplete map. Please retry.")
    normalized_nodes = normalize_map_nodes(nodes, topic)
    if len(normalized_nodes) < 3:
        raise HTTPException(status_code=502, detail="Astra generated an incomplete map. Please retry.")
    now = datetime.now(timezone.utc)
    doc = {"user_id": current_user["_id"], "topic": topic, "knowledge_map": {"nodes": normalized_nodes}, "explored_concepts": ["root"], "selected_concept": "root", "confusion": {}, "challenge_history": [], "created_at": now, "updated_at": now}
    inserted = await db.deep_dives.insert_one(doc)
    doc["_id"] = inserted.inserted_id
    return success_response(data=serialize(doc), message="Knowledge map created.")


@router.patch("/{session_id}")
async def update_session(session_id: str, body: SessionUpdate, current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid Deep Dive session ID.")
    update = body.model_dump(exclude_none=True)
    update["updated_at"] = datetime.now(timezone.utc)
    doc = await db.deep_dives.find_one_and_update({"_id": ObjectId(session_id), "user_id": current_user["_id"]}, {"$set": update}, return_document=ReturnDocument.AFTER)
    if not doc:
        raise HTTPException(status_code=404, detail="Deep Dive session not found.")
    return success_response(data=serialize(doc))


@router.post("/{session_id}/ai")
async def concept_ai(session_id: str, body: AIRequest, current_user: dict = Depends(get_current_user), db: AsyncIOMotorDatabase = Depends(get_database)):
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid Deep Dive session ID.")
    session = await db.deep_dives.find_one({"_id": ObjectId(session_id), "user_id": current_user["_id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Deep Dive session not found.")
    context = f"Topic: {session['topic']}. Selected concept: {body.concept}."
    if body.action == "challenge":
        prompt = f'''{context} Create one multiple choice learning question based on explored concepts {body.related_concepts}. Return {{"question":"...","options":["...","...","...","..."],"answer":1,"explanation":"brief why"}}. answer is zero-based.'''
    elif body.action == "question":
        prompt = f'''{context} The learner asks: {body.prompt}. Give a focused, friendly answer in under 130 words. Return {{"answer":"..."}}.'''
    else:
        instruction = {"explain": "Explain simply for a beginner", "example": "Give one practical example", "compare": "Compare it with the most relevant nearby concept"}[body.action]
        prompt = f'''{context} {instruction}. Return {{"answer":"...","subconcepts":[{{"label":"...","summary":"...","difficulty":"Beginner|Intermediate|Advanced"}}]}}. Include 0-3 genuinely useful deeper subconcepts.'''
    result = await ai_json(prompt)
    return success_response(data=result)
