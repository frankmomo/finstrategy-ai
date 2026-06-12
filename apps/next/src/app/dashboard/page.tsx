import { Suspense } from "react";
import { AnalysisConsole } from "@/components/analysis-console";
import { MarketBoard } from "@/components/market-board";
import { OptionsChainServer } from "@/components/options-chain-server";
import { PanelSkeleton } from "@/components/skeletons";
import { requireSessionUserId } from "@/lib/session";

export default async function DashboardPage() {
  await requireSessionUserId();

  return (
    <main className="min-h-screen bg-terminal-bg p-4 text-terminal-text lg:p-6">
      <header className="mb-4 flex flex-col gap-2 border-b border-terminal-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-terminal-cyan">FinStrategy Engine</p>
          <h1 className="text-3xl font-semibold text-white">Market Command Center</h1>
        </div>
        <p className="max-w-2xl text-sm text-terminal-muted">
          Analysis-only terminal for SPY, TSLA, and NVDA. Real market providers are injected through server routes and
          streaming clients; no execution engine is enabled.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.8fr)]">
        <Suspense fallback={<PanelSkeleton title="Loading market stream" />}>
          <MarketBoard />
        </Suspense>
        <AnalysisConsole />
      </div>

      <section className="mt-4">
        <Suspense fallback={<PanelSkeleton title="Loading options chain" />}>
          <OptionsChainServer ticker="SPY" />
        </Suspense>
      </section>
    </main>
  );
}
