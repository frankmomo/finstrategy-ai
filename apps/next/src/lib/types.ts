export type Ticker = "SPY" | "TSLA" | "NVDA";

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
