import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const REQUEST_TIMEOUT_MS = 20_000;

function getMarketApiBase() {
  return process.env.MARKET_API_BASE_URL || "";
}

export async function POST(request: Request) {
  const baseUrl = getMarketApiBase();
  const apiKey = process.env.MARKET_API_KEY;
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "El backend de lectura de estrategias no esta configurado" }, { status: 503 });
  }

  const formData = await request.formData();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/strategies/from-image`, {
      method: "POST",
      headers: {
        "X-FinStrategy-Key": apiKey
      },
      body: formData,
      cache: "no-store",
      signal: controller.signal
    });
  } catch {
    return NextResponse.json({ error: "No se pudo leer la estrategia. Revisa el backend o intenta de nuevo." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json"
    }
  });
}
