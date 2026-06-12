# FinStrategy Engine

Production-oriented web app for real-time analysis of SPY, MSFT, TSLA, NVDA, AAPL, META, GOOGL, NFLX, AMZN, and PLTR.

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
VITE_API_BASE_URL=https://YOUR-RAILWAY-API-DOMAIN/api
DATABASE_URL=
ENVIRONMENT=production
APP_API_KEY=
POLYGON_API_KEY=
OPENAI_API_KEY=
FMP_API_KEY=
OPTIONS_DATA_PROVIDER=fmp
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
CORS_ORIGINS=https://finstrategy-ai.vercel.app
TICKERS=SPY,MSFT,TSLA,NVDA,AAPL,META,GOOGL,NFLX,AMZN,PLTR
POLYGON_INGESTION_MODE=rest_poll
MARKET_DATA_TIMEFRAME=1d
ENABLE_API_INGESTION=false
```

`APP_API_KEY` is mandatory when `ENVIRONMENT=production`. In local development it can be empty, but protected endpoints will only be meaningfully tested when a key is configured.

## Operational Endpoints

```txt
/api/health
/api/auth/verify
/api/market/latest
/api/market/coverage
/api/market/history/{ticker}?timeframe=1m
/api/options-chain?ticker=SPY
/api/worker/status
/api/strategies/{strategy_id}/backtest
```

All dashboard data endpoints except `/api/health` and `/api/auth/verify` require `X-FinStrategy-Key`.

## Next.js Options Chain Provider

The production Next.js dashboard loads option chains through server routes so API keys are never exposed to the browser.

Configure one provider in Vercel for `apps/next`:

```txt
OPTIONS_DATA_PROVIDER=fmp
FMP_API_KEY=xxxxxxxx
```

or:

```txt
OPTIONS_DATA_PROVIDER=polygon
POLYGON_API_KEY=xxxxxxxx
```

The normalized endpoint is:

```txt
GET /api/options-chain?ticker=SPY
```

It returns `{ ticker, underlyingPrice, provider, updatedAt, contracts }`, where each contract includes bid/ask/mid, last, IV, greeks when available, volume, open interest, spread percent, and a technical quality score. If no provider is configured, the dashboard shows a Spanish configuration message instead of mock data.

Local test:

```powershell
cd apps\next
npm run dev
# open http://localhost:3000/dashboard and click a CALL/PUT strategy signal
```

Legacy variable list:

```txt
DATABASE_URL=
POLYGON_API_KEY=
OPENAI_API_KEY=
FMP_API_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
CORS_ORIGINS=
TICKERS=SPY,MSFT,TSLA,NVDA,AAPL,META,GOOGL,NFLX,AMZN,PLTR
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

This is an analysis and alerting product, not financial advice, not an automated advisor, and not an execution engine. Keep order execution out of scope until compliance, audit logging, user disclosures, and broker integrations are formally reviewed.
