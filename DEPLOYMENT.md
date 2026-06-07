# FinStrategy Deployment

## Target topology

- Vercel: static React/Vite dashboard from `dist`.
- Railway API service: FastAPI app using `apps/api/Dockerfile`.
- Railway worker service: background Polygon ingestion and strategy evaluator using `apps/worker/Dockerfile`.
- Railway Postgres: shared database for API and worker.

## Railway API service

Use Dockerfile path:

```txt
apps/api/Dockerfile
```

Use Railway config source:

```txt
railway.api.json
```

Start command is handled by the Dockerfile and respects Railway's `PORT`:

```txt
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Run migrations once after Postgres is attached:

```powershell
python scripts/migrate.py
```

Health check:

```txt
/api/health
```

## Railway worker service

Use Dockerfile path:

```txt
apps/worker/Dockerfile
```

Use Railway config source:

```txt
railway.worker.json
```

Start command:

```txt
python worker/realtime_worker.py
```

If the current Polygon plan does not include WebSocket access, set:

```txt
POLYGON_INGESTION_MODE=rest_poll
MARKET_DATA_TIMEFRAME=1d
```

When WebSocket access is upgraded, set:

```txt
POLYGON_INGESTION_MODE=websocket
MARKET_DATA_TIMEFRAME=1m
```

## Vercel frontend

`vercel.json` pins:

```txt
buildCommand=npm run build
outputDirectory=dist
framework=vite
```

Set this Vercel env var to the Railway API public URL:

```txt
VITE_API_BASE_URL=https://YOUR-RAILWAY-API-DOMAIN/api
```

Then add the final Vercel domain to Railway API:

```txt
CORS_ORIGINS=https://YOUR-VERCEL-DOMAIN,https://YOUR-CUSTOM-DOMAIN
```

## Required production env vars

API and worker:

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
POLYGON_WS_URL=wss://socket.polygon.io/stocks
POLYGON_INGESTION_MODE=rest_poll
MARKET_DATA_TIMEFRAME=1d
POLYGON_REST_POLL_SECONDS=30
```

Vercel:

```txt
VITE_API_BASE_URL=
```

## Pre-production checks

- `/api/health` returns `status: ok`.
- `/api/market/latest` returns real Polygon bars.
- `/api/chat` answers with market context and does not expose secrets.
- Dashboard build preview shows prices and DeepSeek Copilot response.
- No synthetic `1m` data is present while running REST polling.
- FMP news returns articles or fails gracefully with an empty list.
- Rotate any API key that has ever appeared in local logs before public launch.
