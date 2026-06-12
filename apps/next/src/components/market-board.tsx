import { getChartHistory, getInitialQuotes } from "@/lib/market-data";
import { MarketBoardClient } from "./market-board-client";

export async function MarketBoard() {
  const [quotes, spyHistory, tslaHistory, nvdaHistory] = await Promise.all([
    getInitialQuotes(),
    getChartHistory("SPY"),
    getChartHistory("TSLA"),
    getChartHistory("NVDA")
  ]);

  return (
    <MarketBoardClient
      initialQuotes={quotes}
      historyByTicker={{ SPY: spyHistory, TSLA: tslaHistory, NVDA: nvdaHistory }}
    />
  );
}
