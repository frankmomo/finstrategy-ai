from uuid import UUID
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from ..db import acquire, using_sqlite
from ..models import StrategyCreate
from ..rate_limit import check_rate_limit
from ..serialization import row_to_dict
from ..services.vision_parser import parse_strategy_image

router = APIRouter(tags=["strategies"])


@router.post("/strategies")
async def create_strategy(payload: StrategyCreate) -> dict:
    strategy_id = uuid4()
    async with acquire() as conn:
        await conn.execute(
            """
            INSERT INTO strategies (id, name, tickers, timeframe, rules, confidence)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            """,
            strategy_id,
            payload.name,
            payload.tickers,
            payload.timeframe,
            payload.rules.model_dump(mode="json"),
            payload.confidence,
        )
        row = await conn.fetchrow(
            """
            SELECT id, name, tickers, timeframe, rules, status, confidence, created_at
            FROM strategies
            WHERE id = $1
            """,
            strategy_id,
        )
    return row_to_dict(row)


@router.post("/strategies/from-image")
async def create_strategy_from_image(
    request: Request,
    file: UploadFile = File(...),
    name: str | None = Form(None),
) -> dict:
    check_rate_limit(request, bucket="vision", max_requests=5, window_seconds=3600)
    image_bytes = await file.read()
    if len(image_bytes) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be 8 MB or smaller")
    try:
        rules, confidence = parse_strategy_image(
            image_bytes,
            file.content_type or "image/png",
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    strategy_id = uuid4()
    strategy_name = name or rules.notes or "Imported Strategy"
    async with acquire() as conn:
        await conn.execute(
            """
            INSERT INTO strategies (id, name, tickers, timeframe, rules, confidence)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            """,
            strategy_id,
            strategy_name,
            rules.tickers,
            rules.timeframe,
            rules.model_dump(mode="json"),
            confidence,
        )
        row = await conn.fetchrow(
            """
            SELECT id, name, tickers, timeframe, rules, status, confidence, created_at
            FROM strategies
            WHERE id = $1
            """,
            strategy_id,
        )

    return row_to_dict(row)


@router.get("/strategies")
async def list_strategies(status: str = "active") -> list[dict]:
    async with acquire() as conn:
        if using_sqlite():
            rows = await conn.fetch(
                """
                SELECT id, name, tickers, timeframe, rules, status, confidence, created_at, updated_at
                FROM strategies
                WHERE status = $1
                ORDER BY created_at DESC
                """,
                status,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT id, name, tickers, timeframe, rules, status, confidence, created_at, updated_at
                FROM strategies
                WHERE ($1::text IS NULL OR status = $1)
                ORDER BY created_at DESC
                """,
                status,
            )
    return [row_to_dict(row) for row in rows]


@router.patch("/strategies/{strategy_id}/status")
async def update_strategy_status(strategy_id: UUID, status: str) -> dict:
    if status not in {"active", "paused", "archived"}:
        raise HTTPException(status_code=400, detail="Invalid strategy status")

    async with acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE strategies
            SET status = $2, updated_at = now()
            WHERE id = $1
            RETURNING id, name, status
            """,
            strategy_id,
            status,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Strategy not found")
    return row_to_dict(row)


@router.get("/alerts")
async def list_alerts(limit: int = 50) -> list[dict]:
    async with acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id, a.strategy_id, s.name AS strategy_name, a.ticker, a.price,
                   a.payload, a.status, a.triggered_at
            FROM alerts a
            LEFT JOIN strategies s ON s.id = a.strategy_id
            ORDER BY a.triggered_at DESC
            LIMIT $1
            """,
            min(max(limit, 1), 200),
        )
    return [row_to_dict(row) for row in rows]
