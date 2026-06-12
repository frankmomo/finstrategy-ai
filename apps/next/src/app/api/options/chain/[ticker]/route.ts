import { NextResponse } from "next/server";
import { getOptionChain } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { ticker: string } }) {
  return NextResponse.json(await getOptionChain(params.ticker.toUpperCase()));
}
