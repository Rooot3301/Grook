import { Component } from 'react';

/**
 * Error boundary React classique. Sans ça, une erreur non-catchée dans une
 * page fait blanchir tout l'arbre React et le dashboard "crashe" en silence.
 *
 * Ici on affiche un panneau qui explique le problème et laisse la sidebar
 * accessible pour naviguer ailleurs.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // On log dans la console pour que F12 -> Console montre la vraie stack.
    console.error('[dashboard] Page crash :', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const err = this.state.error;
      return (
        <div className="px-8 py-8 max-w-[800px] mx-auto">
          <div className="panel p-6">
            <div className="h-eyebrow mb-2 text-danger">page en erreur</div>
            <div className="font-display text-2xl mb-3">Quelque chose a planté sur cette page.</div>
            <p className="text-text-dim text-sm mb-5">
              Le reste du dashboard reste utilisable — utilise la sidebar pour aller ailleurs,
              ou clique sur "Réessayer" ci-dessous.
            </p>
            <details className="mb-5 text-xs font-mono text-text-dim">
              <summary className="cursor-pointer text-text hover:text-accent">Détail technique</summary>
              <pre className="mt-3 overflow-auto panel-2 p-3 whitespace-pre-wrap break-words">
{`${err?.name ?? 'Error'} — ${err?.message ?? String(err)}
${err?.stack ?? ''}`}
              </pre>
            </details>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={this.reset}>Réessayer</button>
              <button className="btn-ghost" onClick={() => window.location.reload()}>
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
