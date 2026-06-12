export type Ticker = string;

export const SUPPORTED_TICKERS = ["SPY", "MSFT", "TSLA", "NVDA", "AAPL", "META", "GOOGL", "NFLX", "AMZN"] as const;

export type MarketQuote = {
  ticker: Ticker;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  impliedVolatility?: number;
  updatedAt: string;
};

export type OhlcvBar = {
  ticker: Ticker;
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OptionContract = {
  id: string;
  underlyingTicker: Ticker;
  strikePrice: number;
  expirationDate: string;
  optionType: "CALL" | "PUT";
  bid: number;
  ask: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  underlyingPrice: number;
};

export type AnalysisInput = {
  ticker: string;
  price: number;
  volume: number;
  impliedVolatility?: number;
  realizedVolatility?: number;
  timeframe?: string;
  optionGreeks?: Partial<Pick<OptionContract, "delta" | "gamma" | "theta" | "vega">>;
};

export type Strategy = {
  id: string;
  name: string;
  tickers: string[];
  timeframe: string;
  rules: {
    side?: "long" | "short" | "neutral";
    conditions?: Array<Record<string, unknown>>;
    notes?: string;
  };
  status: string;
  confidence?: number;
  created_at?: string;
};

export type StrategyAlert = {
  id: string;
  strategy_id: string;
  strategy_name?: string;
  ticker: string;
  price: number;
  payload: {
    strategy_name?: string;
    timeframe?: string;
    result?: Record<string, unknown>;
    bar?: Record<string, unknown>;
  };
  status: string;
  triggered_at: string;
};

export type OptionBias = {
  ticker: string;
  direction: "CALL" | "PUT" | "WATCH";
  reason: string;
  timeframe?: string;
  price?: number;
};
