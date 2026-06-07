import asyncio
import json
from typing import Any

from ..config import get_settings
from ..db import acquire
from .alerts import create_alert
from .indicators import IndicatorState
from .polygon_rest import PolygonRestPoller
from .polygon_stream import PolygonAggregateStream
from .strategy_engine import evaluate_strategy


state = IndicatorState()


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


async def on_bar(bar: dict[str, Any]) -> None:
    ticker = bar["ticker"]
    state.update(ticker, bar)

    async with acquire() as conn:
        await persist_bar(conn, bar)
        strategies = await load_active_strategies(conn)

        for strategy in strategies:
            if ticker not in strategy["tickers"]:
                continue
            if strategy["timeframe"] != bar["timeframe"]:
                continue
            result = evaluate_strategy(strategy["rules"], state, ticker)
            if result["matched"]:
                await create_alert(
                    conn=conn,
                    strategy_id=strategy["id"],
                    ticker=ticker,
                    price=bar["close"],
                    payload={
                        "strategy_name": strategy["name"],
                        "bar": json.loads(json.dumps(bar, default=str)),
                        "result": result,
                    },
                )
                print(f"[alert] {strategy['name']} matched on {ticker} at {bar['close']}")


async def run_ingestion_forever() -> None:
    settings = get_settings()
    if settings.polygon_ingestion_mode == "rest_poll":
        stream = PolygonRestPoller(on_bar=on_bar)
    else:
        stream = PolygonAggregateStream(on_bar=on_bar)
    await stream.run_forever()


def start_ingestion_task() -> asyncio.Task:
    return asyncio.create_task(run_ingestion_forever(), name="finstrategy-ingestion")
