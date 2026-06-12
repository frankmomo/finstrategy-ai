import { Suspense } from "react";
import { AnalysisConsole } from "@/components/analysis-console";
import { MarketBoard } from "@/components/market-board";
import { PanelSkeleton } from "@/components/skeletons";
import { TradeWorkspace } from "@/components/trade-workspace";
import { requireSessionUserId } from "@/lib/session";

export default async function DashboardPage() {
  await requireSessionUserId();

  return (
    <main className="min-h-screen bg-terminal-bg p-4 text-terminal-text lg:p-6">
      <header className="mb-4 flex flex-col gap-2 border-b border-terminal-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-terminal-cyan">FinStrategy Engine</p>
          <h1 className="text-3xl font-semibold text-white">Panel de control de mercado</h1>
        </div>
        <p className="max-w-2xl text-sm text-terminal-muted">
          Terminal de analisis para watchlist de acciones, validacion de estrategias subidas e investigacion de entradas en opciones.
          Los proveedores reales se consultan desde rutas de servidor; no hay motor de ejecucion activo.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.8fr)]">
        <Suspense fallback={<PanelSkeleton title="Cargando mercado" />}>
          <MarketBoard />
        </Suspense>
        <AnalysisConsole />
      </div>

      <Suspense fallback={<PanelSkeleton title="Cargando estrategias y opciones" />}>
        <TradeWorkspace />
      </Suspense>
    </main>
  );
}
