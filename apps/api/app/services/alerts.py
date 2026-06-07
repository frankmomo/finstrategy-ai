from typing import Any
from uuid import UUID

import asyncpg


async def create_alert(
    conn: asyncpg.Connection,
    strategy_id: UUID,
    ticker: str,
    price: float,
    payload: dict[str, Any],
) -> None:
    await conn.execute(
        """
        INSERT INTO alerts (strategy_id, ticker, price, payload)
        VALUES ($1, $2, $3, $4::jsonb)
        """,
        strategy_id,
        ticker,
        price,
        payload,
    )
