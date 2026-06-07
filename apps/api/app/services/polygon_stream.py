import asyncio
import json
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any

import websockets

from ..config import get_settings

BarCallback = Callable[[dict[str, Any]], Awaitable[None]]


class PolygonAggregateStream:
    def __init__(self, on_bar: BarCallback):
        self.settings = get_settings()
        self.on_bar = on_bar

    async def run_forever(self) -> None:
        if not self.settings.polygon_api_key:
            raise RuntimeError("POLYGON_API_KEY is required for real-time ingestion")

        while True:
            try:
                await self._connect_once()
            except Exception as exc:
                print(f"[polygon] stream error: {exc}; reconnecting in 5s")
                await asyncio.sleep(5)

    async def _connect_once(self) -> None:
        async with websockets.connect(
            self.settings.polygon_ws_url,
            ping_interval=20,
            ping_timeout=20,
        ) as ws:
            await ws.send(json.dumps({"action": "auth", "params": self.settings.polygon_api_key}))
            await _wait_for_auth_success(ws)
            channels = ",".join(f"AM.{ticker}" for ticker in self.settings.ticker_list)
            await ws.send(json.dumps({"action": "subscribe", "params": channels}))
            print(f"[polygon] subscribed: {channels}")

            async for raw in ws:
                events = json.loads(raw)
                if not isinstance(events, list):
                    continue
                for event in events:
                    bar = _parse_aggregate(event)
                    if bar:
                        await self.on_bar(bar)


def _parse_aggregate(event: dict[str, Any]) -> dict[str, Any] | None:
    if event.get("ev") not in {"A", "AM"}:
        return None

    timestamp_ms = event.get("s") or event.get("e")
    timestamp = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    return {
        "ticker": event["sym"],
        "timeframe": "1m",
        "ts": timestamp,
        "open": float(event["o"]),
        "high": float(event["h"]),
        "low": float(event["l"]),
        "close": float(event["c"]),
        "volume": float(event.get("v") or 0),
    }


async def _wait_for_auth_success(ws) -> None:
    while True:
        raw = await asyncio.wait_for(ws.recv(), timeout=20)
        events = json.loads(raw)
        if not isinstance(events, list):
            continue
        for event in events:
            if event.get("ev") != "status":
                continue
            status = event.get("status")
            message = event.get("message", "")
            if status == "auth_success":
                print("[polygon] authenticated")
                return
            if status in {"auth_failed", "error"}:
                raise RuntimeError(f"Polygon authentication failed: {message}")
