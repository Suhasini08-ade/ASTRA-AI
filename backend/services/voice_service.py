"""
services/voice_service.py
=========================
Voice assistant bridge service.

The browser handles speech-to-text via the Web Speech API on the client side.
This service receives the transcribed text, routes it to the AI service,
and returns the response. It acts as the backend counterpart of the
frontend's voice assistant feature.
"""

from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.services.ai_service import ai_service


class VoiceService:
    """Bridges voice input (client-side STT) to the AI chat service."""

    async def process_voice_input(
        self, db: AsyncIOMotorDatabase, user_id: str, text: str
    ) -> str:
        """
        Process transcribed voice text through the AI service.

        :param db: Database instance.
        :param user_id: ID of the authenticated user.
        :param text: Transcribed speech text from the client.
        :return: AI response text (can be spoken by client-side TTS).
        """
        if not text or not text.strip():
            return "I didn't catch that. Could you repeat?"

        return await ai_service.send_message(db, user_id, text)


# Module-level singleton
voice_service = VoiceService()
