export function PanelSkeleton({ title }: { title: string }) {
  return (
    <section className="animate-pulse border border-terminal-border bg-terminal-panel p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-terminal-muted">{title}</p>
      <div className="mt-4 grid gap-3">
        <div className="h-5 rounded bg-slate-800" />
        <div className="h-20 rounded bg-slate-800" />
        <div className="h-5 rounded bg-slate-800" />
      </div>
    </section>
  );
}

export function MarketSkeleton() {
  return (
    <main className="min-h-screen bg-terminal-bg p-6">
      <PanelSkeleton title="Booting market terminal" />
    </main>
  );
}
