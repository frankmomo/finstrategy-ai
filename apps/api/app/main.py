from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import close_db, connect_db
from .routes.strategies import router as strategies_router
from .routes.market import router as market_router
from .routes.news import router as news_router
from .routes.chat import router as chat_router


settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    await connect_db()


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_db()


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "finstrategy-api",
        "tickers": settings.ticker_list,
    }


app.include_router(strategies_router, prefix="/api")
app.include_router(market_router, prefix="/api")
app.include_router(news_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
