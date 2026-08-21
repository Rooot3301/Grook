/**
 * Wrapper de page — offre header cohérent avec eyebrow + title + description
 * et un container qui gère le padding.
 */
export function Page({ eyebrow, title, description, actions, children }) {
  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          {eyebrow && <div className="h-eyebrow mb-2">{eyebrow}</div>}
          <h1 className="h-display text-3xl leading-tight">{title}</h1>
          {description && <p className="text-text-dim mt-2 max-w-2xl leading-relaxed">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="panel py-12 px-6 text-center">
      <div className="h-eyebrow mb-3">rien à afficher</div>
      <div className="font-display text-xl mb-2">{title}</div>
      {description && <p className="text-text-dim text-sm max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingRow({ label = 'chargement…' }) {
  return (
    <div className="panel p-6 text-center text-text-dim">
      <span className="pulse-dot mr-2" />
      <span className="font-mono text-xs uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function Stamp({ children }) {
  return <span className="stamp">{children}</span>;
}
