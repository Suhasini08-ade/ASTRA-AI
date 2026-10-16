"""Voice-only AI route: shared tools/provider, intentionally no chat persistence."""
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field

from backend.database import get_database
from backend.services.voice_service import voice_service
from backend.utils.auth import get_current_user
from backend.utils.response import success_response

router = APIRouter(prefix="/api/voice", tags=["Voice AI"])


class VoiceCommand(BaseModel):
    message: str | None = Field(default=None, max_length=5000)
    command: str | None = Field(default=None, max_length=5000)

    @property
    def query(self) -> str:
        return (self.message or self.command or "").strip()


@router.post("/command")
async def process_command(
    body: VoiceCommand,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    query_text = body.query
    if not query_text:
        return success_response(data={"reply": "Please provide a command or question."}, message="No command provided.")

    reply = await voice_service.process_voice_input(db, current_user["_id"], query_text)
    if isinstance(reply, dict):
        return success_response(data=reply, message="Voice command processed.")
    return success_response(data={"reply": reply, "spoken_summary": reply}, message="Voice command processed.")
