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
    message: str = Field(..., min_length=1, max_length=5000)


@router.post("/command")
async def process_command(
    body: VoiceCommand,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    reply = await voice_service.process_voice_input(db, current_user["_id"], body.message)
    return success_response(data={"reply": reply}, message="Voice command processed.")
