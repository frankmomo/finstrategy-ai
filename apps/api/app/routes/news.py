from fastapi import APIRouter, HTTPException

from ..services.news_client import fetch_ticker_news

router = APIRouter(tags=["news"])


@router.get("/news/{ticker}")
async def ticker_news(ticker: str, limit: int = 10) -> list[dict]:
    try:
        return await fetch_ticker_news(ticker, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"News provider error: {exc}") from exc
