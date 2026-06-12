import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getMarketApiBase() {
  return process.env.MARKET_API_BASE_URL || "";
}

export async function POST(request: Request) {
  const baseUrl = getMarketApiBase();
  const apiKey = process.env.MARKET_API_KEY;
  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "Strategy parser backend is not configured" }, { status: 503 });
  }

  const formData = await request.formData();
  const response = await fetch(`${baseUrl}/strategies/from-image`, {
    method: "POST",
    headers: {
      "X-FinStrategy-Key": apiKey
    },
    body: formData,
    cache: "no-store"
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json"
    }
  });
}
