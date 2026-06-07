from contextlib import asynccontextmanager
from pathlib import Path
import json
import re
from typing import Any, AsyncIterator
from uuid import UUID

import aiosqlite
import asyncpg

from .config import get_settings


pool: asyncpg.Pool | None = None
sqlite_path: Path | None = None


class Row(dict):
    def __getattr__(self, key: str) -> Any:
        return self[key]


class SQLiteConnection:
    def __init__(self, conn: aiosqlite.Connection):
        self.conn = conn

    async def execute(self, query: str, *args: Any):
        sql, values = _sqlite_query(query, args)
        await self.conn.execute(sql, values)
        await self.conn.commit()

    async def fetch(self, query: str, *args: Any) -> list[Row]:
        sql, values = _sqlite_query(query, args)
        cursor = await self.conn.execute(sql, values)
        rows = await cursor.fetchall()
        return [_decode_row(dict(row)) for row in rows]

    async def fetchrow(self, query: str, *args: Any) -> Row | None:
        sql, values = _sqlite_query(query, args)
        cursor = await self.conn.execute(sql, values)
        row = await cursor.fetchone()
        return _decode_row(dict(row)) if row else None


async def _init_connection(conn: asyncpg.Connection) -> None:
    for type_name in ("json", "jsonb"):
        await conn.set_type_codec(
            type_name,
            encoder=json.dumps,
            decoder=json.loads,
            schema="pg_catalog",
            format="text",
        )


def _is_sqlite() -> bool:
    return get_settings().database_url.startswith("sqlite")


def using_sqlite() -> bool:
    return _is_sqlite()


async def connect_db() -> None:
    global pool, sqlite_path
    settings = get_settings()
    if settings.database_url.startswith("sqlite"):
        raw_path = settings.database_url.replace("sqlite:///", "", 1)
        sqlite_path = Path(raw_path).resolve()
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(sqlite_path) as conn:
            await conn.executescript(_sqlite_schema())
            await conn.commit()
        return

    if pool is None:
        pool = await asyncpg.create_pool(
            settings.database_url,
            min_size=1,
            max_size=10,
            command_timeout=30,
            init=_init_connection,
        )


async def close_db() -> None:
    global pool
    if pool is not None:
        await pool.close()
        pool = None


@asynccontextmanager
async def acquire() -> AsyncIterator[Any]:
    if _is_sqlite():
        if sqlite_path is None:
            await connect_db()
        assert sqlite_path is not None
        conn = await aiosqlite.connect(sqlite_path)
        conn.row_factory = aiosqlite.Row
        try:
            yield SQLiteConnection(conn)
        finally:
            await conn.close()
        return

    if pool is None:
        await connect_db()
    assert pool is not None
    async with pool.acquire() as conn:
        yield conn


def _sqlite_query(query: str, args: tuple[Any, ...]) -> tuple[str, list[Any]]:
    values: list[Any] = []

    def replace(match: re.Match[str]) -> str:
        index = int(match.group(1)) - 1
        value = args[index]
        if isinstance(value, (dict, list)):
            values.append(json.dumps(value))
        elif isinstance(value, UUID):
            values.append(str(value))
        else:
            values.append(value)
        return "?"

    sql = query
    sql = re.sub(r"\$(\d+)::[a-zA-Z_]+", r"$\1", sql)
    sql = re.sub(r"\$(\d+)", replace, sql)
    sql = sql.replace("::jsonb", "")
    sql = re.sub(r"RETURNING\s+.+", "", sql, flags=re.IGNORECASE | re.DOTALL)
    return sql, values


def _decode_row(row: dict[str, Any]) -> Row:
    for key in ("rules", "payload", "tickers"):
        if key in row and isinstance(row[key], str):
            try:
                row[key] = json.loads(row[key])
            except json.JSONDecodeError:
                pass
    return Row(row)


def _sqlite_schema() -> str:
    return """
    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      name TEXT NOT NULL,
      source_image_url TEXT,
      tickers TEXT NOT NULL,
      timeframe TEXT NOT NULL DEFAULT '1m',
      rules TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      confidence REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS market_bars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      ts TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (ticker, timeframe, ts)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      strategy_id TEXT REFERENCES strategies(id) ON DELETE CASCADE,
      ticker TEXT NOT NULL,
      triggered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      price REAL NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new'
    );

    CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
    CREATE INDEX IF NOT EXISTS idx_market_bars_ticker_ts ON market_bars(ticker, timeframe, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_alerts_strategy_time ON alerts(strategy_id, triggered_at DESC);
    """
