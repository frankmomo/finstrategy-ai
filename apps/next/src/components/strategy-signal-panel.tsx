"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { OptionBias, Strategy, StrategyAlert } from "@/lib/types";

function optionDirectionFromSide(side?: string): OptionBias["direction"] {
  if (side === "long") return "CALL";
  if (side === "short") return "PUT";
  return "WATCH";
}

function signalFromStrategy(strategy: Strategy): OptionBias[] {
  return strategy.tickers.map((ticker) => ({
    ticker,
    direction: optionDirectionFromSide(strategy.rules?.side),
    timeframe: strategy.timeframe,
    reason: `${strategy.name}: ${strategy.rules?.side || "neutral"} bias from ${strategy.timeframe} strategy`
  }));
}

function signalFromAlert(alert: StrategyAlert, strategy?: Strategy): OptionBias {
  const payload = alert.payload || {};
  const rawSide = String((payload.result as { side?: string } | undefined)?.side || strategy?.rules?.side || "");
  return {
    ticker: alert.ticker,
    direction: optionDirectionFromSide(rawSide),
    timeframe: payload.timeframe || strategy?.timeframe,
    price: Number(alert.price),
    reason: `${alert.strategy_name || payload.strategy_name || "Strategy alert"} triggered at $${Number(alert.price).toFixed(2)}`
  };
}

export function StrategySignalPanel({
  initialStrategies,
  initialAlerts,
  onSelectTicker
}: {
  initialStrategies: Strategy[];
  initialAlerts: StrategyAlert[];
  onSelectTicker?: (ticker: string) => void;
}) {
  const [strategies, setStrategies] = useState(initialStrategies);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const signals = useMemo(() => {
    const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy]));
    const alertSignals = alerts.map((alert) => signalFromAlert(alert, strategyById.get(alert.strategy_id)));
    const strategySignals = strategies.flatMap(signalFromStrategy);
    return [...alertSignals, ...strategySignals].slice(0, 18);
  }, [alerts, strategies]);

  async function uploadStrategy(formData: FormData) {
    setUploading(true);
    setMessage("");
    try {
      const response = await fetch("/api/strategies/upload", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || payload.error || "Strategy upload failed");
      setStrategies((current) => [payload as Strategy, ...current]);
      setMessage("Strategy uploaded and saved. It will be evaluated by the market worker.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Strategy upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await uploadStrategy(new FormData(event.currentTarget));
    event.currentTarget.reset();
  }

  async function refreshSignals() {
    const [nextStrategies, nextAlerts] = await Promise.all([
      fetch("/api/strategies").then((response) => response.json()),
      fetch("/api/alerts").then((response) => response.json())
    ]);
    setStrategies(nextStrategies);
    setAlerts(nextAlerts);
  }

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="flex flex-col gap-2 border-b border-terminal-border pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Strategy Intake</p>
          <h2 className="text-xl font-semibold text-white">Upload Strategy & Options Entry Signals</h2>
        </div>
        <button onClick={refreshSignals} className="border border-terminal-border px-3 py-2 text-xs text-terminal-muted hover:text-white">
          Refresh Signals
        </button>
      </div>

      <form onSubmit={handleUpload} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          className="border border-terminal-border bg-black px-3 py-2 text-sm text-white"
          name="name"
          placeholder="Strategy name"
        />
        <input
          accept="image/*"
          className="border border-terminal-border bg-black px-3 py-2 text-sm text-terminal-muted"
          name="file"
          required
          type="file"
        />
        <button disabled={uploading} className="border border-terminal-cyan bg-cyan-950/30 px-4 py-2 text-terminal-cyan disabled:opacity-50">
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {message && <p className="mt-3 border border-terminal-border bg-black/30 p-3 text-sm text-terminal-muted">{message}</p>}

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {signals.length === 0 && (
          <p className="border border-terminal-border bg-black/30 p-3 text-sm text-terminal-muted lg:col-span-3">
            No strategy signals yet. Upload a strategy screenshot or wait for alerts from the market worker.
          </p>
        )}
        {signals.map((signal, index) => (
          <button
            key={`${signal.ticker}-${signal.direction}-${index}`}
            onClick={() => onSelectTicker?.(signal.ticker)}
            className="border border-terminal-border bg-black/30 p-3 text-left hover:border-terminal-cyan"
          >
            <div className="flex items-center justify-between">
              <strong className="text-white">{signal.ticker}</strong>
              <span
                className={
                  signal.direction === "CALL"
                    ? "text-terminal-green"
                    : signal.direction === "PUT"
                      ? "text-terminal-red"
                      : "text-terminal-amber"
                }
              >
                {signal.direction}
              </span>
            </div>
            <p className="mt-2 text-xs text-terminal-muted">{signal.reason}</p>
            <p className="mt-2 text-xs text-terminal-cyan">
              {signal.timeframe || "--"} {signal.price ? `| $${signal.price.toFixed(2)}` : ""}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
