"use client";

import { useEffect, useMemo, useState } from "react";
import type { OptionChainResponse, OptionContract, OptionBias } from "@/lib/types";

type OptionFilter = "ALL" | "CALL" | "PUT";

function formatNumber(value: number | null, digits = 2) {
  return value === null ? "--" : value.toFixed(digits);
}

function formatCurrency(value: number | null) {
  return value === null ? "--" : `$${value.toFixed(2)}`;
}

function formatPercent(value: number | null, digits = 1) {
  return value === null ? "--" : `${(value * 100).toFixed(digits)}%`;
}

function formatPlainPercent(value: number | null, digits = 1) {
  return value === null ? "--" : `${value.toFixed(digits)}%`;
}

function contractComment(contract: OptionContract) {
  if (contract.spreadPct !== null && contract.spreadPct > 15) {
    return "Advertencia: spread elevado. Puede ser costoso entrar y salir de esta opcion.";
  }
  if ((contract.volume ?? 0) < 100) {
    return "Advertencia: volumen bajo. Puede haber mala ejecucion.";
  }
  if ((contract.openInterest ?? 0) < 100) {
    return "Advertencia: open interest bajo. Verifica profundidad antes de operar.";
  }
  return "Contrato con liquidez aceptable, spread bajo y delta dentro del rango operativo. Revisar tendencia, soporte/resistencia y volatilidad antes de ejecutar.";
}

function scoreClass(score: number) {
  if (score >= 80) return "border-terminal-green text-terminal-green";
  if (score >= 60) return "border-terminal-amber text-terminal-amber";
  return "border-terminal-red text-terminal-red";
}

function greekClass(value: number | null, kind: "delta" | "gamma" | "theta" | "vega") {
  if (value === null) return "text-terminal-muted";
  if (kind === "theta") return value < -0.1 ? "text-terminal-red" : "text-terminal-muted";
  if (kind === "delta") return Math.abs(value) >= 0.25 && Math.abs(value) <= 0.6 ? "text-terminal-green" : "text-terminal-muted";
  if (kind === "gamma") return value > 0.05 ? "text-terminal-amber" : "text-terminal-muted";
  return value > 0.2 ? "text-terminal-cyan" : "text-terminal-muted";
}

function defaultDeltaRange(type: OptionFilter) {
  if (type === "CALL") return { min: 0.25, max: 0.6 };
  if (type === "PUT") return { min: -0.6, max: -0.25 };
  return { min: -0.6, max: 0.6 };
}

export function OptionsChainTable({
  chain,
  suggestedDirection = "ALL",
  title
}: {
  chain: OptionChainResponse;
  suggestedDirection?: OptionBias["direction"] | "ALL";
  title?: string;
}) {
  const initialType = suggestedDirection === "CALL" || suggestedDirection === "PUT" ? suggestedDirection : "ALL";
  const [typeFilter, setTypeFilter] = useState<OptionFilter>(initialType);
  const [expiryFilter, setExpiryFilter] = useState("ALL");
  const [maxDte, setMaxDte] = useState(7);
  const [maxSpread, setMaxSpread] = useState(15);
  const [minVolume, setMinVolume] = useState(100);
  const [minOpenInterest, setMinOpenInterest] = useState(100);
  const [deltaMin, setDeltaMin] = useState(defaultDeltaRange(initialType).min);
  const [deltaMax, setDeltaMax] = useState(defaultDeltaRange(initialType).max);
  const [selectedContract, setSelectedContract] = useState<OptionContract | null>(null);

  useEffect(() => {
    const nextType = suggestedDirection === "CALL" || suggestedDirection === "PUT" ? suggestedDirection : "ALL";
    const range = defaultDeltaRange(nextType);
    setTypeFilter(nextType);
    setDeltaMin(range.min);
    setDeltaMax(range.max);
    setExpiryFilter("ALL");
    setSelectedContract(null);
  }, [chain.ticker, suggestedDirection]);

  const expiries = useMemo(
    () => Array.from(new Set(chain.contracts.map((contract) => contract.expiry))).sort(),
    [chain.contracts]
  );

  const filteredContracts = useMemo(
    () =>
      chain.contracts
        .filter((contract) => {
          const delta = contract.delta;
          return (
            (typeFilter === "ALL" || contract.type === typeFilter) &&
            (expiryFilter === "ALL" || contract.expiry === expiryFilter) &&
            contract.dte <= maxDte &&
            (delta === null || (delta >= deltaMin && delta <= deltaMax)) &&
            (contract.spreadPct === null || contract.spreadPct <= maxSpread) &&
            (contract.volume ?? 0) >= minVolume &&
            (contract.openInterest ?? 0) >= minOpenInterest
          );
        })
        .sort((a, b) => b.qualityScore - a.qualityScore),
    [chain.contracts, deltaMax, deltaMin, expiryFilter, maxDte, maxSpread, minOpenInterest, minVolume, typeFilter]
  );

  const emptyMessage = chain.errorCode
    ? chain.message
    : chain.contracts.length === 0
      ? "No se encontraron contratos disponibles para este ticker."
      : "No hay contratos que cumplan los filtros actuales.";

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="flex flex-col gap-3 border-b border-terminal-border pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Superficie de riesgo de opciones</p>
          <h2 className="text-xl font-semibold text-white">{title || "Cadena de opciones y griegas"}</h2>
          <p className="mt-1 text-xs text-terminal-muted">
            Proveedor: {chain.provider === "none" ? "sin configurar" : chain.provider.toUpperCase()} | Subyacente:{" "}
            {formatCurrency(chain.underlyingPrice)} | Actualizado: {new Date(chain.updatedAt).toLocaleString("es-MX")}
          </p>
          {chain.warnings?.map((warning) => (
            <p key={warning} className="mt-2 border border-terminal-amber/50 bg-yellow-950/20 p-2 text-xs text-terminal-amber">
              {warning}
            </p>
          ))}
        </div>
        <p className="max-w-xl text-xs text-terminal-muted">
          Score tecnico basado en liquidez, spread, delta, DTE e IV. No es recomendacion financiera.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <label className="grid gap-1 text-xs text-terminal-muted">
          Tipo
          <select className="border border-terminal-border bg-black px-2 py-2 text-white" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as OptionFilter)}>
            <option value="ALL">Todos</option>
            <option value="CALL">CALL</option>
            <option value="PUT">PUT</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-terminal-muted">
          Vencimiento
          <select className="border border-terminal-border bg-black px-2 py-2 text-white" value={expiryFilter} onChange={(event) => setExpiryFilter(event.target.value)}>
            <option value="ALL">Todos</option>
            {expiries.map((expiry) => (
              <option key={expiry} value={expiry}>
                {expiry}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-terminal-muted">
          DTE maximo
          <input className="border border-terminal-border bg-black px-2 py-2 text-white" min={0} max={365} type="number" value={maxDte} onChange={(event) => setMaxDte(Number(event.target.value))} />
        </label>
        <label className="grid gap-1 text-xs text-terminal-muted">
          Delta min
          <input className="border border-terminal-border bg-black px-2 py-2 text-white" step="0.01" type="number" value={deltaMin} onChange={(event) => setDeltaMin(Number(event.target.value))} />
        </label>
        <label className="grid gap-1 text-xs text-terminal-muted">
          Delta max
          <input className="border border-terminal-border bg-black px-2 py-2 text-white" step="0.01" type="number" value={deltaMax} onChange={(event) => setDeltaMax(Number(event.target.value))} />
        </label>
        <label className="grid gap-1 text-xs text-terminal-muted">
          Spread max %
          <input className="border border-terminal-border bg-black px-2 py-2 text-white" min={0} type="number" value={maxSpread} onChange={(event) => setMaxSpread(Number(event.target.value))} />
        </label>
        <label className="grid gap-1 text-xs text-terminal-muted">
          Vol/OI min
          <div className="grid grid-cols-2 gap-2">
            <input className="border border-terminal-border bg-black px-2 py-2 text-white" min={0} type="number" value={minVolume} onChange={(event) => setMinVolume(Number(event.target.value))} />
            <input className="border border-terminal-border bg-black px-2 py-2 text-white" min={0} type="number" value={minOpenInterest} onChange={(event) => setMinOpenInterest(Number(event.target.value))} />
          </div>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="mt-4 w-full min-w-[1280px] border-collapse text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.2em] text-terminal-muted">
            <tr>
              {["Calidad", "Tipo", "Vencimiento", "DTE", "Strike", "Bid", "Ask", "Medio", "Ultimo", "IV", "Delta", "Gamma", "Theta", "Vega", "Volumen", "Open Interest", "Spread %"].map((header) => (
                <th key={header} className="border-b border-terminal-border px-3 py-2">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredContracts.map((contract) => (
              <tr
                key={contract.symbol}
                onClick={() => setSelectedContract(contract)}
                className="cursor-pointer border-b border-terminal-border/60 hover:bg-white/5"
              >
                <td className="px-3 py-2">
                  <span className={`inline-flex min-w-12 justify-center border px-2 py-1 text-xs ${scoreClass(contract.qualityScore)}`}>
                    {contract.qualityScore}
                  </span>
                </td>
                <td className={contract.type === "CALL" ? "px-3 py-2 text-terminal-green" : "px-3 py-2 text-terminal-red"}>{contract.type}</td>
                <td className="px-3 py-2">{contract.expiry}</td>
                <td className="px-3 py-2">{contract.dte}</td>
                <td className="px-3 py-2">{formatCurrency(contract.strike)}</td>
                <td className="px-3 py-2">{formatNumber(contract.bid)}</td>
                <td className="px-3 py-2">{formatNumber(contract.ask)}</td>
                <td className="px-3 py-2">{formatNumber(contract.mid, 3)}</td>
                <td className="px-3 py-2">{formatNumber(contract.last)}</td>
                <td className="px-3 py-2">{formatPercent(contract.iv)}</td>
                <td className={`px-3 py-2 ${greekClass(contract.delta, "delta")}`}>{formatNumber(contract.delta, 3)}</td>
                <td className={`px-3 py-2 ${greekClass(contract.gamma, "gamma")}`}>{formatNumber(contract.gamma, 4)}</td>
                <td className={`px-3 py-2 ${greekClass(contract.theta, "theta")}`}>{formatNumber(contract.theta, 3)}</td>
                <td className={`px-3 py-2 ${greekClass(contract.vega, "vega")}`}>{formatNumber(contract.vega, 3)}</td>
                <td className="px-3 py-2">{contract.volume?.toLocaleString() || "--"}</td>
                <td className="px-3 py-2">{contract.openInterest?.toLocaleString() || "--"}</td>
                <td className="px-3 py-2">{formatPlainPercent(contract.spreadPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredContracts.length === 0 && (
        <p className="mt-4 border border-terminal-border bg-black/30 p-3 text-sm text-terminal-muted">
          {emptyMessage}
        </p>
      )}

      {selectedContract && (
        <div className="mt-4 border border-terminal-border bg-black/40 p-4">
          <div className="flex flex-col gap-2 border-b border-terminal-border pb-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Detalle del contrato</p>
              <h3 className="text-lg font-semibold text-white">{selectedContract.symbol}</h3>
            </div>
            <button className="border border-terminal-border px-3 py-2 text-xs text-terminal-muted hover:text-white" onClick={() => setSelectedContract(null)}>
              Cerrar
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Detail label="Tipo" value={`${selectedContract.type} (${selectedContract.type === "CALL" ? "opcion alcista" : "opcion bajista"})`} />
            <Detail label="Strike" value={formatCurrency(selectedContract.strike)} />
            <Detail label="Vencimiento" value={selectedContract.expiry} />
            <Detail label="DTE" value={String(selectedContract.dte)} />
            <Detail label="Bid / Ask / Mid" value={`${formatNumber(selectedContract.bid)} / ${formatNumber(selectedContract.ask)} / ${formatNumber(selectedContract.mid, 3)}`} />
            <Detail label="Delta" value={formatNumber(selectedContract.delta, 3)} />
            <Detail label="Gamma" value={formatNumber(selectedContract.gamma, 4)} />
            <Detail label="Theta" value={formatNumber(selectedContract.theta, 3)} />
            <Detail label="Vega" value={formatNumber(selectedContract.vega, 3)} />
            <Detail label="IV" value={formatPercent(selectedContract.iv)} />
            <Detail label="Volumen" value={selectedContract.volume?.toLocaleString() || "--"} />
            <Detail label="Open Interest" value={selectedContract.openInterest?.toLocaleString() || "--"} />
            <Detail label="Spread %" value={formatPlainPercent(selectedContract.spreadPct)} />
            <Detail label="Score tecnico" value={`${selectedContract.qualityScore}/100`} />
          </div>
          <p className="mt-4 border border-terminal-border bg-terminal-panel p-3 text-sm text-terminal-muted">
            {contractComment(selectedContract)}
          </p>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-terminal-border bg-terminal-panel p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-terminal-muted">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
