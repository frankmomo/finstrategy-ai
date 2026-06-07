from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from ..rate_limit import check_rate_limit
from ..services.deepseek_chat import ask_deepseek

router = APIRouter(tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list)


@router.post("/chat")
async def chat(payload: ChatRequest, request: Request) -> dict:
    check_rate_limit(request, bucket="chat", max_requests=12, window_seconds=900)
    try:
        return await ask_deepseek(
            payload.message,
            [item.model_dump() for item in payload.history],
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"DeepSeek provider error: {exc}") from exc
