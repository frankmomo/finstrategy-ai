export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-terminal-bg px-6">
      <section className="w-full max-w-md border border-terminal-border bg-terminal-panel p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-terminal-cyan">FinStrategy</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Session Required</h1>
        <p className="mt-3 text-sm leading-6 text-terminal-muted">
          Connect this route to your production auth provider. The dashboard is protected by middleware and server-side
          session checks.
        </p>
      </section>
    </main>
  );
}
