import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any

import httpx

from ..config import get_settings

BarCallback = Callable[[dict[str, Any]], Awaitable[None]]


class PolygonRestPoller:
    def __init__(self, on_bar: BarCallback):
        self.settings = get_settings()
        self.on_bar = on_bar

    async def run_forever(self) -> None:
        if not self.settings.polygon_api_key:
            raise RuntimeError("POLYGON_API_KEY is required for REST polling")

        async with httpx.AsyncClient(timeout=15) as client:
            while True:
                for ticker in self.settings.ticker_list:
                    bar = await self._fetch_previous_bar(client, ticker)
                    if bar:
                        await self.on_bar(bar)
                    if self.settings.polygon_rest_ticker_delay_seconds > 0:
                        await asyncio.sleep(self.settings.polygon_rest_ticker_delay_seconds)
                await asyncio.sleep(self.settings.polygon_rest_poll_seconds)

    async def _fetch_previous_bar(self, client: httpx.AsyncClient, ticker: str) -> dict[str, Any] | None:
        response = await client.get(
            f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev",
            params={"adjusted": "true", "apiKey": self.settings.polygon_api_key},
        )
        if response.status_code == 429:
            print(f"[polygon-rest] rate limited while fetching {ticker}; skipping this cycle")
            return None
        if response.status_code >= 400:
            print(f"[polygon-rest] provider error {response.status_code} while fetching {ticker}")
            return None
        payload = response.json()
        results = payload.get("results") or []
        if not results:
            return None

        result = results[0]
        timestamp = datetime.fromtimestamp(result["t"] / 1000, tz=timezone.utc)
        return {
            "ticker": ticker,
            "timeframe": "1d",
            "ts": timestamp,
            "open": float(result["o"]),
            "high": float(result["h"]),
            "low": float(result["l"]),
            "close": float(result["c"]),
            "volume": float(result.get("v") or 0),
        }
