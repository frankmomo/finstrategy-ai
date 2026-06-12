import { getOptionChain } from "@/lib/market-data";
import type { Ticker } from "@/lib/types";
import { OptionsChainTable } from "./options-chain-table";

export async function OptionsChainServer({ ticker }: { ticker: Ticker }) {
  const contracts = await getOptionChain(ticker);
  return <OptionsChainTable contracts={contracts} />;
}
