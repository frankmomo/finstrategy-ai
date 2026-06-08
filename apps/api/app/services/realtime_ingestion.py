import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from ..config import get_settings
from ..db import acquire, using_sqlite
from .alerts import create_alert
from .indicators import IndicatorState
from .polygon_rest import PolygonRestPoller, fetch_historical_bars
from .polygon_stream import PolygonAggregateStream
from .strategy_engine import evaluate_strategy


state = IndicatorState()
processed_bars = 0
hydrated_keys: set[tuple[str, str]] = set()
aggregation_buckets: dict[tuple[str, str, datetime], dict[str, Any]] = {}
DERIVED_INTRADAY_TIMEFRAMES = ("5m", "15m")
DAILY_STRATEGY_MIN_BARS = 200


async def load_active_strategies(conn) -> list[dict[str, Any]]:
    rows = await conn.fetch(
        """
        SELECT id, name, tickers, timeframe, rules
        FROM strategies
        WHERE status = 'active'
        """
    )
    strategies = []
    for row in rows:
        strategy = dict(row)
        try:
            if isinstance(strategy.get("rules"), str):
                strategy["rules"] = json.loads(strategy["rules"])
            if isinstance(strategy.get("tickers"), str):
                strategy["tickers"] = json.loads(strategy["tickers"])
        except json.JSONDecodeError:
            print(f"[worker] skipping invalid strategy payload: {strategy.get('id')}")
            continue
        strategies.append(strategy)
    return strategies


async def persist_bar(conn, bar: dict[str, Any]) -> None:
    await conn.execute(
        """
        INSERT INTO market_bars (ticker, timeframe, ts, open, high, low, close, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (ticker, timeframe, ts)
        DO UPDATE SET open = EXCLUDED.open,
                      high = EXCLUDED.high,
                      low = EXCLUDED.low,
                      close = EXCLUDED.close,
                      volume = EXCLUDED.volume
        """,
        bar["ticker"],
        bar["timeframe"],
        bar["ts"],
        bar["open"],
        bar["high"],
        bar["low"],
        bar["close"],
        bar["volume"],
    )


async def load_recent_bars(conn, ticker: str, timeframe: str, limit: int) -> list[dict[str, Any]]:
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
    return list(reversed([dict(row) for row in rows]))


async def hydrate_state(conn, ticker: str, timeframe: str, min_bars: int = 1) -> None:
    key = (ticker, timeframe)
    if key in hydrated_keys and state.count(ticker, timeframe) >= min_bars:
        return

    rows = await load_recent_bars(conn, ticker, timeframe, max(state.max_bars, min_bars))
    state.replace(ticker, timeframe, rows)
    hydrated_keys.add(key)


async def ensure_daily_history(conn, ticker: str) -> None:
    rows = await load_recent_bars(conn, ticker, "1d", DAILY_STRATEGY_MIN_BARS)
    if len(rows) >= DAILY_STRATEGY_MIN_BARS:
        state.replace(ticker, "1d", rows)
        hydrated_keys.add((ticker, "1d"))
        return

    print(f"[worker] fetching daily backfill for {ticker}; current_bars={len(rows)}")
    bars = await fetch_historical_bars(ticker, "1d", DAILY_STRATEGY_MIN_BARS)
    for bar in bars:
        await persist_bar(conn, bar)
    if bars:
        state.replace(ticker, "1d", bars)
        hydrated_keys.add((ticker, "1d"))
    print(f"[worker] daily backfill {ticker}: fetched={len(bars)} required={DAILY_STRATEGY_MIN_BARS}")


async def backfill_daily_strategy_data() -> None:
    async with acquire() as conn:
        strategies = await load_active_strategies(conn)
        tickers = sorted(
            {
                ticker
                for strategy in strategies
                if strategy["timeframe"] == "1d"
                for ticker in strategy["tickers"]
            }
        )
        for ticker in tickers:
            await ensure_daily_history(conn, ticker)
            await evaluate_strategies_for_bar(conn, {"ticker": ticker, "timeframe": "1d"}, strategies)


async def on_bar(bar: dict[str, Any]) -> None:
    global processed_bars
    ticker = bar["ticker"]
    timeframe = bar["timeframe"]
    state.update(ticker, timeframe, bar)

    async with acquire() as conn:
        await persist_bar(conn, bar)
        strategies = await load_active_strategies(conn)
        await evaluate_strategies_for_bar(conn, bar, strategies)
        if timeframe == "1m":
            for derived_bar in derive_intraday_bars(bar):
                state.update(ticker, derived_bar["timeframe"], derived_bar)
                await persist_bar(conn, derived_bar)
                await evaluate_strategies_for_bar(conn, derived_bar, strategies)

    processed_bars += 1
    if processed_bars == 1 or processed_bars % 25 == 0:
        print(
            "[worker] persisted "
            f"{processed_bars} bars; latest={ticker} {bar['timeframe']} {bar['ts']}"
        )


async def evaluate_strategies_for_bar(conn, bar: dict[str, Any], strategies: list[dict[str, Any]]) -> None:
    ticker = bar["ticker"]
    timeframe = bar["timeframe"]
    min_bars = DAILY_STRATEGY_MIN_BARS if timeframe == "1d" else 1
    await hydrate_state(conn, ticker, timeframe, min_bars=min_bars)

    latest = bar
    if "close" not in latest:
        recent = await load_recent_bars(conn, ticker, timeframe, 1)
        if not recent:
            return
        latest = recent[-1]

    for strategy in strategies:
        if ticker not in strategy["tickers"]:
            continue
        if strategy["timeframe"] != timeframe:
            continue
        result = evaluate_strategy(strategy["rules"], state, ticker, timeframe)
        if result["matched"]:
            if await alert_already_exists(conn, strategy["id"], ticker, timeframe, str(latest["ts"])):
                continue
            await create_alert(
                conn=conn,
                strategy_id=strategy["id"],
                ticker=ticker,
                price=float(latest["close"]),
                payload={
                    "strategy_name": strategy["name"],
                    "timeframe": timeframe,
                    "bar": json.loads(json.dumps(latest, default=str)),
                    "result": result,
                },
            )
            print(f"[alert] {strategy['name']} matched on {ticker} {timeframe} at {latest['close']}")


async def alert_already_exists(conn, strategy_id: Any, ticker: str, timeframe: str, bar_ts: str) -> bool:
    if using_sqlite():
        return False

    row = await conn.fetchrow(
        """
        SELECT id
        FROM alerts
        WHERE strategy_id = $1
          AND ticker = $2
          AND payload->>'timeframe' = $3
          AND payload->'bar'->>'ts' = $4
        LIMIT 1
        """,
        strategy_id,
        ticker,
        timeframe,
        bar_ts,
    )
    return row is not None


def derive_intraday_bars(bar: dict[str, Any]) -> list[dict[str, Any]]:
    out = []
    for timeframe in DERIVED_INTRADAY_TIMEFRAMES:
        out.append(update_aggregate_bar(bar, timeframe))
    return out


def update_aggregate_bar(bar: dict[str, Any], timeframe: str) -> dict[str, Any]:
    bucket_ts = floor_minute_bucket(bar["ts"], int(timeframe[:-1]))
    key = (bar["ticker"], timeframe, bucket_ts)
    existing = aggregation_buckets.get(key)
    if existing is None:
        existing = {
            "ticker": bar["ticker"],
            "timeframe": timeframe,
            "ts": bucket_ts,
            "open": bar["open"],
            "high": bar["high"],
            "low": bar["low"],
            "close": bar["close"],
            "volume": bar.get("volume") or 0,
        }
        aggregation_buckets[key] = existing
        return dict(existing)

    existing["high"] = max(existing["high"], bar["high"])
    existing["low"] = min(existing["low"], bar["low"])
    existing["close"] = bar["close"]
    existing["volume"] = (existing.get("volume") or 0) + (bar.get("volume") or 0)
    return dict(existing)


def floor_minute_bucket(ts: datetime, minutes: int) -> datetime:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    bucket_minute = (ts.minute // minutes) * minutes
    return ts.replace(minute=bucket_minute, second=0, microsecond=0)


async def run_ingestion_forever() -> None:
    settings = get_settings()
    print(
        "[worker] starting ingestion "
        f"mode={settings.polygon_ingestion_mode} timeframe={settings.market_data_timeframe} "
        f"tickers={','.join(settings.ticker_list)}"
    )
    await backfill_daily_strategy_data()
    if settings.polygon_ingestion_mode == "rest_poll":
        stream = PolygonRestPoller(on_bar=on_bar)
    else:
        stream = PolygonAggregateStream(on_bar=on_bar)
    await stream.run_forever()


def start_ingestion_task() -> asyncio.Task:
    return asyncio.create_task(run_ingestion_forever(), name="finstrategy-ingestion")
