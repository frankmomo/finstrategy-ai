"use client";

import { useState } from "react";
import { SUPPORTED_TICKERS, type OptionBias, type OptionChainResponse, type Strategy, type StrategyAlert } from "@/lib/types";
import { OptionsChainTable } from "./options-chain-table";
import { StrategySignalPanel } from "./strategy-signal-panel";

export function TradeWorkspaceClient({
  initialStrategies,
  initialAlerts,
  initialOptionChain
}: {
  initialStrategies: Strategy[];
  initialAlerts: StrategyAlert[];
  initialOptionChain: OptionChainResponse;
}) {
  const [selectedTicker, setSelectedTicker] = useState("SPY");
  const [suggestedDirection, setSuggestedDirection] = useState<OptionBias["direction"] | "ALL">("ALL");
  const [optionChain, setOptionChain] = useState(initialOptionChain);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  async function selectTicker(ticker: string, direction: OptionBias["direction"] | "ALL" = "ALL") {
    const nextTicker = ticker.toUpperCase();
    setSelectedTicker(nextTicker);
    setSuggestedDirection(direction);
    setLoadingOptions(true);
    setOptionsError("");
    try {
      const response = await fetch(`/api/options-chain?ticker=${encodeURIComponent(nextTicker)}`);
      const payload = (await response.json()) as OptionChainResponse;
      setOptionChain(payload);
      if (!response.ok || payload.errorCode === "PROVIDER_ERROR") {
        setOptionsError(payload.message || "Error al cargar contratos. Revisa la API key o el proveedor.");
      }
    } catch {
      setOptionsError("Error al cargar contratos. Revisa la API key o el proveedor.");
    } finally {
      setLoadingOptions(false);
    }
  }

  function selectSignal(signal: OptionBias) {
    void selectTicker(signal.ticker, signal.direction);
  }

  const title =
    suggestedDirection === "CALL" || suggestedDirection === "PUT"
      ? `Contratos ${suggestedDirection} disponibles para ${selectedTicker}`
      : `Contratos CALL/PUT disponibles para ${selectedTicker}`;

  return (
    <div className="mt-4 grid gap-4">
      <StrategySignalPanel
        initialStrategies={initialStrategies}
        initialAlerts={initialAlerts}
        onSelectTicker={selectSignal}
      />

      <section className="border border-terminal-border bg-terminal-panel p-4">
        <div className="mb-4 flex flex-col gap-3 border-b border-terminal-border pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Vigilancia de ejecucion de opciones</p>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-terminal-muted">
              Selecciona un ticker o haz clic en una senal para inspeccionar posibles contratos CALL (opcion alcista) o PUT (opcion bajista).
            </p>
          </div>
          <label className="grid gap-1 text-sm text-terminal-muted">
            Subyacente
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
        {optionsError && (
          <p className="mb-4 border border-terminal-red/50 bg-red-950/20 p-3 text-sm text-terminal-red">
            {optionsError}
          </p>
        )}
        {loadingOptions ? (
          <p className="border border-terminal-border bg-black/30 p-3 text-sm text-terminal-muted">Cargando contratos de opciones...</p>
        ) : (
          <OptionsChainTable chain={optionChain} suggestedDirection={suggestedDirection} title={title} />
        )}
      </section>
    </div>
  );
}
