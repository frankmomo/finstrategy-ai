import httpx

from ..config import get_settings


async def fetch_ticker_news(ticker: str, limit: int = 10) -> list[dict]:
    settings = get_settings()
    if not settings.fmp_api_key:
        return []

    url = "https://financialmodelingprep.com/stable/news/stock"
    params = {
        "symbols": ticker.upper(),
        "limit": min(max(limit, 1), 50),
        "apikey": settings.fmp_api_key,
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url, params=params)
        if response.status_code in {402, 403}:
            return []
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, list) else []
