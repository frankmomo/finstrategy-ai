import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import type { AnalysisInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildPrompt(input: AnalysisInput) {
  return [
    "You are FinStrategy Engine, a trading-analysis copilot for a professional market dashboard.",
    "Use only the supplied hard market data. Do not invent prices, volume, implied volatility, or order execution.",
    "Return concise Markdown with: Market State, Volatility/Options Read, Technical Bias, Invalidations, and Risk Notes.",
    "This is analysis only, not personalized financial advice.",
    "",
    "Market input JSON:",
    JSON.stringify(input, null, 2)
  ].join("\n");
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
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = (await request.json()) as AnalysisInput;
  if (!input.ticker || !Number.isFinite(input.price) || !Number.isFinite(input.volume)) {
    return NextResponse.json({ error: "ticker, price and volume are required" }, { status: 422 });
  }

  const provider = getProviderConfig();
  if (!provider.key) return NextResponse.json({ error: "LLM provider key is not configured" }, { status: 503 });

  const encoder = new TextEncoder();
  const prompt = buildPrompt(input);
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
        { role: "system", content: "You are a precise fintech market-analysis assistant." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `LLM provider failed: ${upstream.statusText}` }, { status: 502 });
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
          await getPrisma().marketAnalysis.create({
            data: {
              userId,
              ticker: input.ticker.toUpperCase(),
              aiModelUsed: provider.model,
              inputSnapshot: input,
              analysisOutput
            }
          });
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
