import { getActiveStrategies, getOptionChain, getRecentAlerts } from "@/lib/market-data";
import { TradeWorkspaceClient } from "./trade-workspace-client";

export async function TradeWorkspace() {
  const [strategies, alerts, optionChain] = await Promise.all([
    getActiveStrategies(),
    getRecentAlerts(),
    getOptionChain("SPY")
  ]);

  return <TradeWorkspaceClient initialStrategies={strategies} initialAlerts={alerts} initialOptionChain={optionChain} />;
}
