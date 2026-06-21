from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.models.user import User
from app.schemas.agent import ChatRequest, ChatResponse
from app.services.agent_runner import run_chat
from app.services.auth import get_current_user

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    user: User = Depends(get_current_user),
):
    if not settings.google_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI agent is not configured. Set GOOGLE_API_KEY in backend/.env",
        )

    if not payload.message.strip() and not payload.action:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message or action required")

    session_id, message, role, ui_blocks = await run_chat(
        user_id=str(user.id),
        role=user.role.value,
        message=payload.message,
        session_id=payload.session_id,
        action=payload.action,
        action_payload=payload.action_payload,
    )

    return ChatResponse(
        session_id=session_id,
        message=message,
        ui_blocks=ui_blocks,
        role=role,
    )
