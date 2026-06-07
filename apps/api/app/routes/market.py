from fastapi import APIRouter

from ..config import get_settings
from ..db import acquire, using_sqlite
from ..serialization import row_to_dict

router = APIRouter(tags=["market"])


@router.get("/market/latest")
async def latest_market() -> dict[str, dict]:
    settings = get_settings()
    async with acquire() as conn:
        rows = await _fetch_latest_rows(conn, settings.active_market_timeframe)
        if not rows and settings.active_market_timeframe != "1d":
            rows = await _fetch_latest_rows(conn, "1d")
    return {row["ticker"]: row_to_dict(row) for row in rows}


@router.get("/market/history/{ticker}")
async def market_history(ticker: str, limit: int = 240) -> list[dict]:
    settings = get_settings()
    async with acquire() as conn:
        rows = await _fetch_history_rows(conn, ticker.upper(), min(max(limit, 1), 1000), settings.active_market_timeframe)
        if not rows and settings.active_market_timeframe != "1d":
            rows = await _fetch_history_rows(conn, ticker.upper(), min(max(limit, 1), 1000), "1d")
    return list(reversed([row_to_dict(row) for row in rows]))


@router.get("/market/tickers")
async def target_tickers() -> dict:
    return {"tickers": get_settings().ticker_list}


async def _fetch_latest_rows(conn, timeframe: str):
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


async def _fetch_history_rows(conn, ticker: str, limit: int, timeframe: str):
    return await conn.fetch(
        """
        SELECT ticker, timeframe, ts, open, high, low, close, volume
        FROM market_bars
        WHERE ticker = $1 AND timeframe = $3
        ORDER BY ts DESC
        LIMIT $2
        """,
        ticker,
        limit,
        timeframe,
    )
