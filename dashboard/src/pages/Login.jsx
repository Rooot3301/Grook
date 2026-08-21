export function Login() {
  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="mb-8">
          <div className="mx-auto w-12 h-12 mb-4 grid place-items-center rounded-lg border border-border">
            <span className="pulse-dot" />
          </div>
          <div className="h-eyebrow mb-2">grook · dashboard</div>
          <h1 className="h-display text-3xl leading-tight">Registre d'administration</h1>
          <p className="text-text-dim mt-3 text-sm leading-relaxed">
            Accès restreint. Seul le propriétaire déclaré via <span className="font-mono text-text">BOT_OWNER_ID</span> peut ouvrir ce registre.
          </p>
        </div>

        <a href="/auth/login" className="btn-primary w-full justify-center py-2.5">
          Se connecter avec Discord
        </a>

        <div className="mt-8 text-[11px] font-mono text-text-dim/70 leading-relaxed">
          En cas de refus, vérifie que ton ID Discord correspond bien à <span className="text-text-dim">BOT_OWNER_ID</span>.
        </div>
      </div>
    </div>
  );
}
