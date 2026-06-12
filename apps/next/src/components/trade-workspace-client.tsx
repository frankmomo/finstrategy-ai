"use client";

import { useState } from "react";
import { SUPPORTED_TICKERS, type OptionContract, type Strategy, type StrategyAlert } from "@/lib/types";
import { OptionsChainTable } from "./options-chain-table";
import { StrategySignalPanel } from "./strategy-signal-panel";

export function TradeWorkspaceClient({
  initialStrategies,
  initialAlerts,
  initialContracts
}: {
  initialStrategies: Strategy[];
  initialAlerts: StrategyAlert[];
  initialContracts: OptionContract[];
}) {
  const [selectedTicker, setSelectedTicker] = useState("SPY");
  const [contracts, setContracts] = useState(initialContracts);
  const [loadingOptions, setLoadingOptions] = useState(false);

  async function selectTicker(ticker: string) {
    const nextTicker = ticker.toUpperCase();
    setSelectedTicker(nextTicker);
    setLoadingOptions(true);
    try {
      const response = await fetch(`/api/options/chain/${nextTicker}`);
      setContracts(response.ok ? await response.json() : []);
    } finally {
      setLoadingOptions(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      <StrategySignalPanel
        initialStrategies={initialStrategies}
        initialAlerts={initialAlerts}
        onSelectTicker={selectTicker}
      />

      <section className="border border-terminal-border bg-terminal-panel p-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-terminal-border pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Options Execution Watch</p>
            <h2 className="text-xl font-semibold text-white">{selectedTicker} Calls / Puts</h2>
            <p className="mt-1 text-sm text-terminal-muted">
              Pick a ticker or click a strategy signal to inspect possible CALL/PUT contracts.
            </p>
          </div>
          <label className="grid gap-1 text-sm text-terminal-muted">
            Underlying
            <select
              className="border border-terminal-border bg-black px-3 py-2 text-white"
              value={selectedTicker}
              onChange={(event) => void selectTicker(event.target.value)}
            >
              {SUPPORTED_TICKERS.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              ))}
            </select>
          </label>
        </div>
        {loadingOptions ? (
          <p className="border border-terminal-border bg-black/30 p-3 text-sm text-terminal-muted">Loading options chain...</p>
        ) : (
          <OptionsChainTable contracts={contracts} />
        )}
      </section>
    </div>
  );
}
