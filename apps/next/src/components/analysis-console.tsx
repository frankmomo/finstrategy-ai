"use client";

import { useState } from "react";

export function AnalysisConsole() {
  const [ticker, setTicker] = useState("SPY");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [impliedVolatility, setImpliedVolatility] = useState("");
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  async function generateAnalysis() {
    setOutput("");
    setIsStreaming(true);

    const response = await fetch("/api/analysis/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        price: Number(price),
        volume: Number(volume),
        impliedVolatility: impliedVolatility ? Number(impliedVolatility) : undefined
      })
    });

    if (!response.ok || !response.body) {
      setOutput(`El analisis fallo: ${response.statusText}`);
      setIsStreaming(false);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") continue;
        setOutput((current) => current + payload);
      }
    }

    setIsStreaming(false);
  }

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-terminal-cyan">Cinta de estrategia IA</p>
      <h2 className="text-xl font-semibold text-white">Analisis tecnico en streaming</h2>
      <div className="mt-4 grid gap-3">
        <input className="border border-terminal-border bg-black px-3 py-2" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} />
        <input className="border border-terminal-border bg-black px-3 py-2" placeholder="Precio" value={price} onChange={(event) => setPrice(event.target.value)} />
        <input className="border border-terminal-border bg-black px-3 py-2" placeholder="Volumen" value={volume} onChange={(event) => setVolume(event.target.value)} />
        <input className="border border-terminal-border bg-black px-3 py-2" placeholder="Volatilidad implicita" value={impliedVolatility} onChange={(event) => setImpliedVolatility(event.target.value)} />
        <button
          disabled={isStreaming}
          onClick={generateAnalysis}
          className="border border-terminal-cyan bg-cyan-950/30 px-3 py-2 text-terminal-cyan disabled:opacity-50"
        >
          {isStreaming ? "Generando..." : "Generar analisis IA"}
        </button>
      </div>
      <pre className="mt-4 min-h-72 whitespace-pre-wrap border border-terminal-border bg-black/50 p-3 text-sm leading-6 text-terminal-text">
        {output || "Esperando datos estructurados de mercado..."}
      </pre>
    </section>
  );
}
