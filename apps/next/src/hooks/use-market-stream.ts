"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { MarketQuote, Ticker } from "@/lib/types";

type MarketState = Record<Ticker, MarketQuote>;

function createMarketStore(initialQuotes: MarketQuote[]) {
  let state = Object.fromEntries(initialQuotes.map((quote) => [quote.ticker, quote])) as MarketState;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    upsertMany: (quotes: MarketQuote[]) => {
      let changed = false;
      const next = { ...state };
      for (const quote of quotes) {
        const previous = next[quote.ticker];
        if (!previous || previous.price !== quote.price || previous.updatedAt !== quote.updatedAt) {
          next[quote.ticker] = quote;
          changed = true;
        }
      }
      if (changed) {
        state = next;
        listeners.forEach((listener) => listener());
      }
    }
  };
}

export function useMarketStream(initialQuotes: MarketQuote[]) {
  const storeRef = useRef<ReturnType<typeof createMarketStore> | null>(null);
  if (!storeRef.current) storeRef.current = createMarketStore(initialQuotes);

  const getSnapshot = useCallback(() => storeRef.current?.getSnapshot() || ({} as MarketState), []);
  const subscribe = useCallback((listener: () => void) => storeRef.current!.subscribe(listener), []);
  const quotesByTicker = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_MARKET_WS_URL;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let socket: WebSocket | null = null;

    async function poll() {
      const response = await fetch("/api/market/quotes", { cache: "no-store" });
      if (!response.ok) return;
      storeRef.current?.upsertMany((await response.json()) as MarketQuote[]);
    }

    if (wsUrl) {
      socket = new WebSocket(wsUrl);
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as MarketQuote | MarketQuote[];
        storeRef.current?.upsertMany(Array.isArray(payload) ? payload : [payload]);
      };
      socket.onerror = () => {
        socket?.close();
      };
    } else {
      intervalId = setInterval(poll, 5000);
      void poll();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      socket?.close();
    };
  }, []);

  return quotesByTicker;
}
