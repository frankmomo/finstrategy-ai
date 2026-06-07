# FinStrategy Engine

Production-oriented web app for real-time analysis of SPY, MSFT, TSLA, NVDA, AAPL, META, GOOGL, NFLX, and AMZN.

## Current Production

- Dashboard: https://finstrategy-ai.vercel.app
- API: https://api-production-b4ac.up.railway.app/api/health

## Architecture

- `apps/api`: FastAPI service for strategies, market history, alerts, news, and image-to-strategy extraction.
- `apps/worker`: Polygon.io WebSocket worker that stores OHLCV bars and evaluates active strategies.
- `apps/web`: React + Vite dashboard using TradingView Lightweight Charts.
- `migrations`: PostgreSQL schema for strategies, market bars, and alerts.
- DeepSeek Copilot: dashboard chat that answers from saved market bars, active strategies, and recent alerts.

## Core Principle

GPT-4o is used once per uploaded screenshot to convert the visual strategy into structured JSON. Real-time market evaluation is deterministic and uses the saved JSON rules.

## Local Setup

```powershell
Copy-Item .env.example .env
.\.venv\Scripts\python.exe scripts\migrate.py
npm run api:dev
npm run worker:dev
npm run dev
```

SQLite local mode initializes schema on API startup. Use PostgreSQL migrations in production.

Required production variables:

```txt
DATABASE_URL=
POLYGON_API_KEY=
OPENAI_API_KEY=
FMP_API_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
CORS_ORIGINS=
TICKERS=SPY,MSFT,TSLA,NVDA,AAPL,META,GOOGL,NFLX,AMZN
VITE_API_BASE_URL=
```

## Deploy Shape

- API service: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Worker service: `python worker/realtime_worker.py`
- Web: static Vite build from `npm run build`
- Database: managed Postgres with `scripts/migrate.py` run before starting worker/API.

Use `DEPLOYMENT.md` for Railway/Vercel steps. Use `render.yaml` if deploying API + worker + Postgres through Render Blueprints.

If the Polygon plan does not include WebSockets, run `POLYGON_INGESTION_MODE=rest_poll` and `MARKET_DATA_TIMEFRAME=1d`. After upgrading Polygon, switch to `websocket` and `1m`.

## Compliance Note

This is an analysis and alerting product, not an automated advisor or execution engine. Keep order execution out of scope until compliance, audit logging, user disclosures, and broker integrations are formally reviewed.
