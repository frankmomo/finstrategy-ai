const localApiBase =
  window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000/api'
    : '/api';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || localApiBase;

export const TICKERS = ['SPY', 'MSFT', 'TSLA', 'NVDA', 'AAPL', 'META', 'GOOGL', 'NFLX', 'AMZN'];

export type Strategy = {
  id: string;
  name: string;
  tickers: string[];
  timeframe: string;
  rules: {
    side?: string;
    conditions?: Array<Record<string, unknown>>;
    risk?: Record<string, unknown>;
  };
  status: string;
  confidence?: number;
  created_at?: string;
};

export type Alert = {
  id: string;
  strategy_id: string;
  strategy_name?: string;
  ticker: string;
  price: number;
  payload: Record<string, unknown>;
  status: string;
  triggered_at: string;
};

export type MarketBar = {
  ticker: string;
  timeframe: string;
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export async function uploadStrategyImage(file: File, name?: string): Promise<Strategy> {
  const form = new FormData();
  form.append('file', file);
  if (name) form.append('name', name);

  const response = await fetch(`${API_BASE}/strategies/from-image`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<Strategy>;
}

export async function sendChatMessage(message: string, history: ChatMessage[]) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{
    answer: string;
    model: string;
    context: {
      latest_market_count: number;
      active_strategy_count: number;
      recent_alert_count: number;
    };
  }>;
}
