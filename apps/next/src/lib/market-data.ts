import type { MarketQuote, OhlcvBar, OptionContract, Ticker } from "./types";

const TICKERS: Ticker[] = ["SPY", "TSLA", "NVDA"];

function getMarketApiBase() {
  return process.env.MARKET_API_BASE_URL || process.env.NEXT_PUBLIC_MARKET_API_BASE_URL || "";
}

async function marketFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getMarketApiBase();
  if (!baseUrl) return [] as T;

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MARKET_API_KEY ? { "X-FinStrategy-Key": process.env.MARKET_API_KEY } : {}),
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Market API ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function optionalMarketFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await marketFetch<T>(path);
  } catch (error) {
    console.warn(`Optional market data unavailable for ${path}`, error);
    return fallback;
  }
}

export async function getInitialQuotes(): Promise<MarketQuote[]> {
  const latest = await marketFetch<Record<string, OhlcvBar>>("/market/latest");
  return TICKERS.flatMap((ticker) => {
    const bar = latest[ticker];
    if (!bar) return [];
    return {
      ticker,
      price: bar.close,
      change: bar.close - bar.open,
      changePercent: bar.open ? ((bar.close - bar.open) / bar.open) * 100 : 0,
      volume: bar.volume,
      updatedAt: bar.ts
    };
  });
}

export async function getChartHistory(ticker: Ticker): Promise<OhlcvBar[]> {
  return marketFetch<OhlcvBar[]>(`/market/history/${ticker}?timeframe=1m&limit=240`);
}

export async function getOptionChain(ticker: Ticker): Promise<OptionContract[]> {
  return optionalMarketFetch<OptionContract[]>(`/options/chain/${ticker}`, []);
}
