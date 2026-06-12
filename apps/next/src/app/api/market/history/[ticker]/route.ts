import { NextResponse } from "next/server";
import { getChartHistory } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { ticker: string } }) {
  const history = await getChartHistory(params.ticker.toUpperCase());
  return NextResponse.json(history);
}
