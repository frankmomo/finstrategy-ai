export default function LoginPage({
  searchParams
}: {
  searchParams?: { error?: string; next?: string };
}) {
  const nextPath = searchParams?.next || "/dashboard";
  const hasError = searchParams?.error === "invalid";

  return (
    <main className="flex min-h-screen items-center justify-center bg-terminal-bg px-6">
      <section className="w-full max-w-md border border-terminal-border bg-terminal-panel p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.35em] text-terminal-cyan">FinStrategy</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Acceso al panel</h1>
        <p className="mt-3 text-sm leading-6 text-terminal-muted">
          Ingresa la access key privada de FinStrategy. Esto crea una sesion segura temporal para el panel protegido
          mientras se finaliza la autenticacion de produccion.
        </p>
        <form action="/api/session/login" method="post" className="mt-6 grid gap-3">
          <input type="hidden" name="next" value={nextPath} />
          <label className="grid gap-2 text-sm text-terminal-muted">
            Clave de acceso
            <input
              autoComplete="current-password"
              className="border border-terminal-border bg-black px-3 py-2 text-white outline-none focus:border-terminal-cyan"
              name="accessKey"
              placeholder="Pega tu clave de acceso del panel"
              type="password"
            />
          </label>
          {hasError && (
            <p className="border border-terminal-red/50 bg-red-950/30 px-3 py-2 text-sm text-terminal-red">
              Clave de acceso invalida. Intenta de nuevo.
            </p>
          )}
          <button className="border border-terminal-cyan bg-cyan-950/30 px-3 py-2 text-sm font-semibold text-terminal-cyan transition hover:bg-cyan-900/40">
            Entrar al panel
          </button>
        </form>
      </section>
    </main>
  );
}
