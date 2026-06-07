const localApiBase =
  window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://127.0.0.1:8000/api'
    : '/api';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || localApiBase;
const ACCESS_KEY_STORAGE = 'finstrategy_access_key';

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

export function getAccessKey(): string {
  return window.localStorage.getItem(ACCESS_KEY_STORAGE) || '';
}

export function setAccessKey(value: string) {
  if (value.trim()) {
    window.localStorage.setItem(ACCESS_KEY_STORAGE, value.trim());
  } else {
    window.localStorage.removeItem(ACCESS_KEY_STORAGE);
  }
}

function authHeaders(): HeadersInit {
  const key = getAccessKey();
  return key ? { 'X-FinStrategy-Key': key } : {};
}

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
    headers: authHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<Strategy>;
}

export async function sendChatMessage(message: string, history: ChatMessage[]) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
