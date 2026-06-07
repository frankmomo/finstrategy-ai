from typing import Any

from ..config import get_settings
from ..db import acquire, using_sqlite


async def build_market_context(limit: int = 8) -> dict[str, Any]:
    settings = get_settings()
    async with acquire() as conn:
        if using_sqlite():
            market_rows = await conn.fetch(
                """
                SELECT mb.ticker, mb.timeframe, mb.ts, mb.open, mb.high, mb.low, mb.close, mb.volume
                FROM market_bars mb
                INNER JOIN (
                  SELECT ticker, MAX(ts) AS max_ts
                  FROM market_bars
                  WHERE timeframe = $1
                  GROUP BY ticker
                ) latest ON latest.ticker = mb.ticker AND latest.max_ts = mb.ts
                WHERE mb.timeframe = $1
                ORDER BY mb.ticker
                """,
                settings.active_market_timeframe,
            )
        else:
            market_rows = await conn.fetch(
                """
                SELECT DISTINCT ON (ticker) ticker, timeframe, ts, open, high, low, close, volume
                FROM market_bars
                WHERE timeframe = $1
                ORDER BY ticker, ts DESC
                """,
                settings.active_market_timeframe,
            )

        strategy_rows = await conn.fetch(
            """
            SELECT id, name, tickers, timeframe, rules, status, confidence, created_at
            FROM strategies
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT $1
            """,
            limit,
        )
        alert_rows = await conn.fetch(
            """
            SELECT a.ticker, a.price, a.payload, a.status, a.triggered_at, s.name AS strategy_name
            FROM alerts a
            LEFT JOIN strategies s ON s.id = a.strategy_id
            ORDER BY a.triggered_at DESC
            LIMIT $1
            """,
            limit,
        )

    return {
        "latest_market": [dict(row) for row in market_rows],
        "active_strategies": [dict(row) for row in strategy_rows],
        "recent_alerts": [dict(row) for row in alert_rows],
    }
