"use client";

import { useMemo, useState } from "react";
import type { OptionContract } from "@/lib/types";

type Moneyness = "ALL" | "ITM" | "OTM";

function daysToExpiration(expirationDate: string) {
  const ms = new Date(expirationDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function isInTheMoney(contract: OptionContract) {
  if (contract.optionType === "CALL") return contract.underlyingPrice > contract.strikePrice;
  return contract.underlyingPrice < contract.strikePrice;
}

function greekClass(value: number, kind: "delta" | "gamma" | "theta" | "vega") {
  if (kind === "theta") return value < -0.1 ? "text-terminal-red" : "text-terminal-muted";
  if (kind === "delta") return Math.abs(value) > 0.6 ? "text-terminal-green" : "text-terminal-muted";
  if (kind === "gamma") return value > 0.05 ? "text-terminal-amber" : "text-terminal-muted";
  return value > 0.2 ? "text-terminal-cyan" : "text-terminal-muted";
}

export function OptionsChainTable({ contracts }: { contracts: OptionContract[] }) {
  const [maxDte, setMaxDte] = useState(45);
  const [moneyness, setMoneyness] = useState<Moneyness>("ALL");

  const filteredContracts = useMemo(
    () =>
      contracts.filter((contract) => {
        const dte = daysToExpiration(contract.expirationDate);
        const itm = isInTheMoney(contract);
        return dte <= maxDte && (moneyness === "ALL" || (moneyness === "ITM" ? itm : !itm));
      }),
    [contracts, maxDte, moneyness]
  );

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="flex flex-col gap-3 border-b border-terminal-border pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Options Risk Surface</p>
          <h2 className="text-xl font-semibold text-white">Options Chain & Greeks</h2>
        </div>
        <div className="flex gap-3 text-sm">
          <label className="grid gap-1 text-terminal-muted">
            Max DTE
            <input
              className="w-24 border border-terminal-border bg-black px-2 py-1 text-white"
              min={1}
              max={365}
              type="number"
              value={maxDte}
              onChange={(event) => setMaxDte(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1 text-terminal-muted">
            Moneyness
            <select
              className="border border-terminal-border bg-black px-2 py-1 text-white"
              value={moneyness}
              onChange={(event) => setMoneyness(event.target.value as Moneyness)}
            >
              <option value="ALL">ALL</option>
              <option value="ITM">ITM</option>
              <option value="OTM">OTM</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="mt-4 w-full min-w-[920px] border-collapse text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.2em] text-terminal-muted">
            <tr>
              {["Type", "Expiry", "DTE", "Strike", "Bid", "Ask", "IV", "Delta", "Gamma", "Theta", "Vega", "Mny"].map(
                (header) => (
                  <th key={header} className="border-b border-terminal-border px-3 py-2">
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filteredContracts.map((contract) => {
              const dte = daysToExpiration(contract.expirationDate);
              const itm = isInTheMoney(contract);
              return (
                <tr key={contract.id} className="border-b border-terminal-border/60 hover:bg-white/5">
                  <td className="px-3 py-2 text-white">{contract.optionType}</td>
                  <td className="px-3 py-2">{new Date(contract.expirationDate).toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">{dte}</td>
                  <td className="px-3 py-2">${contract.strikePrice.toFixed(2)}</td>
                  <td className="px-3 py-2">{contract.bid.toFixed(2)}</td>
                  <td className="px-3 py-2">{contract.ask.toFixed(2)}</td>
                  <td className="px-3 py-2">{(contract.impliedVolatility * 100).toFixed(1)}%</td>
                  <td className={`px-3 py-2 ${greekClass(contract.delta, "delta")}`}>{contract.delta.toFixed(3)}</td>
                  <td className={`px-3 py-2 ${greekClass(contract.gamma, "gamma")}`}>{contract.gamma.toFixed(4)}</td>
                  <td className={`px-3 py-2 ${greekClass(contract.theta, "theta")}`}>{contract.theta.toFixed(3)}</td>
                  <td className={`px-3 py-2 ${greekClass(contract.vega, "vega")}`}>{contract.vega.toFixed(3)}</td>
                  <td className={itm ? "px-3 py-2 text-terminal-green" : "px-3 py-2 text-terminal-muted"}>
                    {itm ? "ITM" : "OTM"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredContracts.length === 0 && (
        <p className="mt-4 border border-terminal-border bg-black/30 p-3 text-sm text-terminal-muted">
          No option contracts loaded. Connect FMP/Polygon options data to populate this table.
        </p>
      )}
    </section>
  );
}
