import { getChartHistory, getInitialQuotes } from "@/lib/market-data";
import { MarketBoardClient } from "./market-board-client";

export async function MarketBoard() {
  const [quotes, spyHistory] = await Promise.all([
    getInitialQuotes(),
    getChartHistory("SPY")
  ]);

  return (
    <MarketBoardClient
      initialQuotes={quotes}
      initialHistory={spyHistory}
    />
  );
}
