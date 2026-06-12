import { NextResponse } from "next/server";
import { getActiveStrategies } from "@/lib/market-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getActiveStrategies());
}
