import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
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
            retry_after = _retry_after_seconds(response)
            print(f"[polygon-rest] rate limited while fetching {ticker}; backing off {retry_after}s")
            await asyncio.sleep(retry_after)
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


async def fetch_historical_bars(ticker: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.polygon_api_key:
        raise RuntimeError("POLYGON_API_KEY is required for historical backfill")

    multiplier, timespan, lookback_days = _polygon_range(timeframe, limit)
    end = datetime.now(tz=timezone.utc).date()
    start = end - timedelta(days=lookback_days)

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"https://api.polygon.io/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{start}/{end}",
            params={
                "adjusted": "true",
                "sort": "asc",
                "limit": 5000,
                "apiKey": settings.polygon_api_key,
            },
        )
        if response.status_code == 429:
            retry_after = _retry_after_seconds(response)
            print(f"[polygon-rest] historical rate limited for {ticker} {timeframe}; backing off {retry_after}s")
            await asyncio.sleep(retry_after)
            return []
        if response.status_code >= 400:
            print(f"[polygon-rest] historical provider error {response.status_code} for {ticker} {timeframe}")
            return []

    bars = []
    for result in (response.json().get("results") or [])[-limit:]:
        bars.append(
            {
                "ticker": ticker,
                "timeframe": timeframe,
                "ts": datetime.fromtimestamp(result["t"] / 1000, tz=timezone.utc),
                "open": float(result["o"]),
                "high": float(result["h"]),
                "low": float(result["l"]),
                "close": float(result["c"]),
                "volume": float(result.get("v") or 0),
            }
        )
    return bars


def _polygon_range(timeframe: str, limit: int) -> tuple[int, str, int]:
    if timeframe == "1d":
        return 1, "day", max(450, limit * 3)
    if timeframe.endswith("m"):
        minutes = int(timeframe[:-1])
        return minutes, "minute", 10
    if timeframe.endswith("h"):
        hours = int(timeframe[:-1])
        return hours, "hour", 90
    return 1, "day", max(450, limit * 3)


def _retry_after_seconds(response: httpx.Response) -> int:
    raw_value = response.headers.get("Retry-After")
    if raw_value:
        try:
            return max(5, min(int(raw_value), 120))
        except ValueError:
            pass
    return 60
