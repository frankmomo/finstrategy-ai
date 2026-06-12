import { getOptionChain } from "@/lib/market-data";
import type { Ticker } from "@/lib/types";
import { OptionsChainTable } from "./options-chain-table";

export async function OptionsChainServer({ ticker }: { ticker: Ticker }) {
  const chain = await getOptionChain(ticker);
  return <OptionsChainTable chain={chain} title={`Contratos CALL/PUT disponibles para ${ticker}`} />;
}
