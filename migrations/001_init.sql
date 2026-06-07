CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_image_url TEXT,
  tickers TEXT[] NOT NULL,
  timeframe TEXT NOT NULL DEFAULT '1m',
  rules JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_bars (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  open NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  close NUMERIC NOT NULL,
  volume NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticker, timeframe, ts)
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  price NUMERIC NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_strategies_status ON strategies(status);
CREATE INDEX IF NOT EXISTS idx_strategies_rules_gin ON strategies USING GIN (rules);
CREATE INDEX IF NOT EXISTS idx_market_bars_ticker_ts ON market_bars(ticker, timeframe, ts DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_strategy_time ON alerts(strategy_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_ticker_time ON alerts(ticker, triggered_at DESC);
