from typing import Any

from ..config import get_settings
from ..db import acquire, using_sqlite
from ..serialization import row_to_dict


CHAT_TIMEFRAMES = ("1m", "5m", "15m", "1d")
INTRADAY_TIMEFRAMES = {"1m", "5m", "15m"}
DAILY_MIN_BARS = 200
CHAT_INTRADAY_SAMPLE_BARS = 60
CHAT_DAILY_SAMPLE_BARS = 80


async def build_market_context(limit: int = 8) -> dict[str, Any]:
    settings = get_settings()
    tickers = settings.ticker_list

    async with acquire() as conn:
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
        strategies = [row_to_dict(row) for row in strategy_rows]

        market_by_timeframe = {}
        for timeframe in CHAT_TIMEFRAMES:
            latest_rows = await _fetch_latest_market_rows(conn, timeframe)
            recent_by_ticker = {}
            coverage_by_ticker = {}
            history_limit = CHAT_DAILY_SAMPLE_BARS if timeframe == "1d" else CHAT_INTRADAY_SAMPLE_BARS
            for ticker in tickers:
                rows = await _fetch_history_rows(conn, ticker, timeframe, history_limit)
                recent_by_ticker[ticker] = [row_to_dict(row) for row in rows]
                coverage_by_ticker[ticker] = await _count_bars(conn, ticker, timeframe)

            market_by_timeframe[timeframe] = {
                "label": "intraday" if timeframe in INTRADAY_TIMEFRAMES else "daily",
                "sample_bars_requested": history_limit,
                "required_bars_for_strategy": DAILY_MIN_BARS if timeframe == "1d" else None,
                "available_bar_count_by_ticker": coverage_by_ticker,
                "latest": [row_to_dict(row) for row in latest_rows],
                "recent_bars_by_ticker": recent_by_ticker,
            }

        daily_warnings = await _daily_history_warnings(conn, strategies)
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

    latest_market = market_by_timeframe["1m"]["latest"] or market_by_timeframe["1d"]["latest"]
    return {
        "data_contract": {
            "intraday_timeframes": ["1m", "5m", "15m"],
            "daily_timeframes": ["1d"],
            "daily_min_bars_for_1d_strategies": DAILY_MIN_BARS,
        },
        "market_by_timeframe": market_by_timeframe,
        "latest_market": latest_market,
        "active_strategies": strategies,
        "recent_alerts": [row_to_dict(row) for row in alert_rows],
        "warnings": daily_warnings,
    }


async def _fetch_latest_market_rows(conn, timeframe: str):
    if using_sqlite():
        return await conn.fetch(
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
            timeframe,
        )

    return await conn.fetch(
        """
        SELECT DISTINCT ON (ticker) ticker, timeframe, ts, open, high, low, close, volume
        FROM market_bars
        WHERE timeframe = $1
        ORDER BY ticker, ts DESC
        """,
        timeframe,
    )


async def _fetch_history_rows(conn, ticker: str, timeframe: str, limit: int):
    rows = await conn.fetch(
        """
        SELECT ticker, timeframe, ts, open, high, low, close, volume
        FROM market_bars
        WHERE ticker = $1 AND timeframe = $2
        ORDER BY ts DESC
        LIMIT $3
        """,
        ticker,
        timeframe,
        limit,
    )
    return list(reversed(rows))


async def _daily_history_warnings(conn, strategies: list[dict[str, Any]]) -> list[str]:
    warnings = []
    required_tickers = sorted(
        {
            ticker
            for strategy in strategies
            if strategy.get("timeframe") == "1d"
            for ticker in strategy.get("tickers", [])
        }
    )
    for ticker in required_tickers:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS count
            FROM market_bars
            WHERE ticker = $1 AND timeframe = $2
            """,
            ticker,
            "1d",
        )
        count = int(row["count"]) if row else 0
        if count < DAILY_MIN_BARS:
            warnings.append(
                f"Daily history for {ticker} has {count} bars; 1d strategies require at least {DAILY_MIN_BARS}."
            )
    return warnings


async def _count_bars(conn, ticker: str, timeframe: str) -> int:
    row = await conn.fetchrow(
        """
        SELECT COUNT(*) AS count
        FROM market_bars
        WHERE ticker = $1 AND timeframe = $2
        """,
        ticker,
        timeframe,
    )
    return int(row["count"]) if row else 0
