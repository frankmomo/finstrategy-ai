import { NextResponse } from "next/server";
import { getInitialQuotes } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const quotes = await getInitialQuotes();
  return NextResponse.json(quotes);
}
