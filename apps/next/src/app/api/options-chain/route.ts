import { NextResponse } from "next/server";
import { getOptionsChain } from "@/lib/options-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") || "SPY";
  const data = await getOptionsChain(ticker);
  const status = data.errorCode === "PROVIDER_ERROR" ? 502 : 200;
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "s-maxage=45, stale-while-revalidate=60"
    }
  });
}
