import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getActiveStrategies, getMarketHistory, getOptionChain, getRecentAlerts } from "@/lib/market-data";
import { getPrisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import type { AnalysisInput, OhlcvBar, OptionContract } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TimeframeSummary = {
  timeframe: string;
  label: "intradia" | "diario";
  barCount: number;
  latestBar?: OhlcvBar;
  sma20: number | null;
  sma50: number | null;
  changeFromPreviousPct: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  averageVolume20: number | null;
  volumeVsAverage20Pct: number | null;
  trend: "alcista" | "bajista" | "lateral" | "insuficiente";
  recentBars: OhlcvBar[];
  warning?: string;
};

type AnalysisContext = {
  request: AnalysisInput;
  ticker: string;
  generatedAt: string;
  manualOverrides: Partial<Pick<AnalysisInput, "price" | "volume" | "impliedVolatility">>;
  marketByTimeframe: Record<string, TimeframeSummary>;
  options: {
    provider: string;
    underlyingPrice: number | null;
    updatedAt: string;
    totalContracts: number;
    topCalls: OptionContract[];
    topPuts: OptionContract[];
    warnings: string[];
  };
  strategies: unknown[];
  recentAlerts: unknown[];
  warnings: string[];
};

const ANALYSIS_TIMEFRAMES = [
  { timeframe: "1m", limit: 160, label: "intradia" as const },
  { timeframe: "5m", limit: 160, label: "intradia" as const },
  { timeframe: "15m", limit: 160, label: "intradia" as const },
  { timeframe: "1d", limit: 220, label: "diario" as const }
];

function round(value: number | null | undefined, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeBars(timeframe: string, label: "intradia" | "diario", bars: OhlcvBar[]): TimeframeSummary {
  const latestBar = bars.at(-1);
  const previousBar = bars.at(-2);
  const closes = bars.map((bar) => bar.close).filter(Number.isFinite);
  const last20 = bars.slice(-20);
  const last50 = bars.slice(-50);
  const sma20 = average(last20.map((bar) => bar.close));
  const sma50 = average(last50.map((bar) => bar.close));
  const rangeHigh = last20.length ? Math.max(...last20.map((bar) => bar.high)) : null;
  const rangeLow = last20.length ? Math.min(...last20.map((bar) => bar.low)) : null;
  const averageVolume20 = average(last20.map((bar) => bar.volume));
  const volumeVsAverage20Pct =
    latestBar && averageVolume20 && averageVolume20 > 0 ? ((latestBar.volume - averageVolume20) / averageVolume20) * 100 : null;
  const changeFromPreviousPct =
    latestBar && previousBar && previousBar.close ? ((latestBar.close - previousBar.close) / previousBar.close) * 100 : null;
  const latestClose = closes.at(-1);
  let trend: TimeframeSummary["trend"] = "insuficiente";
  if (latestClose && sma20 && sma50) {
    if (latestClose > sma20 && sma20 > sma50) trend = "alcista";
    else if (latestClose < sma20 && sma20 < sma50) trend = "bajista";
    else trend = "lateral";
  }

  return {
    timeframe,
    label,
    barCount: bars.length,
    latestBar,
    sma20: round(sma20, 3),
    sma50: round(sma50, 3),
    changeFromPreviousPct: round(changeFromPreviousPct, 3),
    rangeHigh: round(rangeHigh, 3),
    rangeLow: round(rangeLow, 3),
    averageVolume20: round(averageVolume20, 0),
    volumeVsAverage20Pct: round(volumeVsAverage20Pct, 2),
    trend,
    recentBars: bars.slice(-25),
    warning: timeframe === "1d" && bars.length < 200 ? `Solo hay ${bars.length} velas diarias; para contexto diario robusto se recomiendan al menos 200.` : undefined
  };
}

async function safeHistory(ticker: string, timeframe: string, limit: number) {
  try {
    return await getMarketHistory(ticker, timeframe, limit);
  } catch {
    return [];
  }
}

async function buildAnalysisContext(input: AnalysisInput): Promise<AnalysisContext> {
  const ticker = input.ticker.toUpperCase();
  const [historyResults, optionChain, strategies, alerts] = await Promise.all([
    Promise.all(ANALYSIS_TIMEFRAMES.map((item) => safeHistory(ticker, item.timeframe, item.limit))),
    getOptionChain(ticker),
    getActiveStrategies(),
    getRecentAlerts()
  ]);

  const marketByTimeframe = Object.fromEntries(
    ANALYSIS_TIMEFRAMES.map((item, index) => [
      item.timeframe,
      summarizeBars(item.timeframe, item.label, historyResults[index] || [])
    ])
  );
  const relevantStrategies = strategies.filter((strategy) => strategy.tickers.includes(ticker)).slice(0, 8);
  const relevantAlerts = alerts.filter((alert) => alert.ticker === ticker).slice(0, 12);
  const optionWarnings = optionChain.message ? [optionChain.message] : [];
  const warnings = [
    ...Object.values(marketByTimeframe)
      .map((summary) => summary.warning)
      .filter((warning): warning is string => Boolean(warning)),
    ...optionWarnings
  ];

  return {
    request: input,
    ticker,
    generatedAt: new Date().toISOString(),
    manualOverrides: {
      price: input.price,
      volume: input.volume,
      impliedVolatility: input.impliedVolatility
    },
    marketByTimeframe,
    options: {
      provider: optionChain.provider,
      underlyingPrice: optionChain.underlyingPrice,
      updatedAt: optionChain.updatedAt,
      totalContracts: optionChain.contracts.length,
      topCalls: optionChain.contracts.filter((contract) => contract.type === "CALL").slice(0, 8),
      topPuts: optionChain.contracts.filter((contract) => contract.type === "PUT").slice(0, 8),
      warnings: optionWarnings
    },
    strategies: relevantStrategies,
    recentAlerts: relevantAlerts,
    warnings
  };
}

function buildPrompt(context: AnalysisContext) {
  return [
    "Eres FinStrategy Engine, un copiloto de analisis de trading para un panel profesional de mercado.",
    "Responde siempre en espanol.",
    "Usa solo los datos duros suministrados. No inventes precios, volumen, volatilidad implicita, griegas ni ejecucion de ordenes.",
    "El contexto separa datos intradia (1m, 5m, 15m), diarios (1d), opciones, estrategias activas y alertas recientes.",
    "Da una lectura practica para decidir si conviene estudiar CALL, PUT o esperar, pero aclara que no es recomendacion financiera.",
    "Si los datos diarios son insuficientes o las opciones tienen baja liquidez/spread alto, dilo antes de cualquier conclusion.",
    "Devuelve Markdown conciso con estas secciones: Estado del mercado, Contexto historico multi-timeframe, Lectura de opciones, Sesgo CALL/PUT, Contratos a revisar, Invalidaciones y Riesgos.",
    "",
    "Contexto de mercado enriquecido en JSON:",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getProviderConfig() {
  const provider = process.env.AI_PROVIDER || "deepseek";
  if (provider === "openai") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini"
    };
  }

  return {
    url: `${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions`,
    key: process.env.DEEPSEEK_API_KEY,
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat"
  };
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const input = (await request.json()) as AnalysisInput;
  if (!input.ticker) {
    return NextResponse.json({ error: "ticker es requerido" }, { status: 422 });
  }

  const provider = getProviderConfig();
  if (!provider.key) return NextResponse.json({ error: "La API key del proveedor LLM no esta configurada" }, { status: 503 });

  const encoder = new TextEncoder();
  const context = await buildAnalysisContext(input);
  const prompt = buildPrompt(context);
  let analysisOutput = "";

  const upstream = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: provider.model,
      stream: true,
      temperature: 0.2,
      messages: [
        { role: "system", content: "Eres un asistente fintech preciso de analisis de mercado. Responde en espanol." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Fallo el proveedor LLM: ${upstream.statusText}` }, { status: 502 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const raw = decoder.decode(value, { stream: true });
          for (const line of raw.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              const token = parsed.choices?.[0]?.delta?.content || "";
              if (!token) continue;
              analysisOutput += token;
              controller.enqueue(encoder.encode(`data: ${token}\n\n`));
            } catch {
              continue;
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        if (analysisOutput.trim()) {
          try {
            await getPrisma().marketAnalysis.create({
              data: {
                userId,
                ticker: input.ticker.toUpperCase(),
                aiModelUsed: provider.model,
                inputSnapshot: toInputJsonValue(context),
                analysisOutput
              }
            });
          } catch (error) {
            console.warn("No se pudo guardar el historial de analisis IA", error);
          }
        }
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
