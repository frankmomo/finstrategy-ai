"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarketStream } from "@/hooks/use-market-stream";
import { SUPPORTED_TICKERS, type MarketQuote, type OhlcvBar, type Ticker } from "@/lib/types";
import { MetricCard } from "./metric-card";

export function MarketBoardClient({
  initialQuotes,
  initialHistory
}: {
  initialQuotes: MarketQuote[];
  initialHistory: OhlcvBar[];
}) {
  const [selectedTicker, setSelectedTicker] = useState<Ticker>("SPY");
  const [historyByTicker, setHistoryByTicker] = useState<Record<Ticker, OhlcvBar[]>>({ SPY: initialHistory });
  const [historyLoading, setHistoryLoading] = useState(false);
  const quotesByTicker = useMarketStream(initialQuotes);
  const selectedHistory = historyByTicker[selectedTicker] || [];
  const selectedQuote = quotesByTicker[selectedTicker];

  const totalVolume = useMemo(
    () => Object.values(quotesByTicker).reduce((sum, quote) => sum + quote.volume, 0),
    [quotesByTicker]
  );

  useEffect(() => {
    if (historyByTicker[selectedTicker]) return;
    setHistoryLoading(true);
    fetch(`/api/market/history/${selectedTicker}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((history: OhlcvBar[]) => {
        setHistoryByTicker((current) => ({ ...current, [selectedTicker]: history }));
      })
      .finally(() => setHistoryLoading(false));
  }, [historyByTicker, selectedTicker]);

  const minLow = selectedHistory.length ? Math.min(...selectedHistory.map((item) => item.low)) : 0;
  const maxHigh = selectedHistory.length ? Math.max(...selectedHistory.map((item) => item.high)) : 0;
  const range = maxHigh - minLow;

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Mercado en vivo</p>
          <h2 className="text-xl font-semibold text-white">Watchlist de mercado</h2>
        </div>
        <div className="text-right text-xs text-terminal-muted">Respaldo por polling: 5s</div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {SUPPORTED_TICKERS.map((ticker) => {
          const quote = quotesByTicker[ticker];
          const tone = quote?.changePercent && quote.changePercent >= 0 ? "positive" : "negative";
          return (
            <button
              key={ticker}
              onClick={() => setSelectedTicker(ticker)}
              className={`border p-3 text-left transition ${
                selectedTicker === ticker ? "border-terminal-cyan bg-cyan-950/20" : "border-terminal-border bg-black/20"
              }`}
            >
              <p className="text-sm text-terminal-muted">{ticker}</p>
              <p className="mt-1 text-2xl font-semibold text-white">{quote ? `$${quote.price.toFixed(2)}` : "--"}</p>
              <p className={tone === "positive" ? "text-terminal-green" : "text-terminal-red"}>
                {quote ? `${quote.changePercent.toFixed(2)}%` : "esperando datos"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MetricCard label="Seleccionado" value={selectedTicker} />
        <MetricCard label="Ultimo precio" value={selectedQuote ? `$${selectedQuote.price.toFixed(2)}` : "--"} />
        <MetricCard label="Volumen de sesion" value={totalVolume.toLocaleString()} tone="warning" />
      </div>

      <div className="mt-4 h-72 border border-terminal-border bg-black/30 p-3">
        <div className="mb-3 flex items-center justify-between text-xs text-terminal-muted">
          <span>{selectedTicker} OHLCV</span>
          <span>{historyLoading ? "cargando..." : `${selectedHistory.length} velas`}</span>
        </div>
        <div className="flex h-56 items-end gap-1 overflow-hidden">
          {selectedHistory.map((bar) => {
            const height = range ? Math.max(4, ((bar.close - minLow) / range) * 210) : 4;
            return (
              <div
                key={bar.ts}
                title={`${bar.ts} close ${bar.close}`}
                className={bar.close >= bar.open ? "w-1 bg-terminal-green" : "w-1 bg-terminal-red"}
                style={{ height }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
