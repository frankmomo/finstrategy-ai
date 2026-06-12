export function MetricCard({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-terminal-green"
      : tone === "negative"
        ? "text-terminal-red"
        : tone === "warning"
          ? "text-terminal-amber"
          : "text-white";

  return (
    <div className="border border-terminal-border bg-black/30 p-3">
      <p className="text-[10px] uppercase tracking-[0.25em] text-terminal-muted">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
