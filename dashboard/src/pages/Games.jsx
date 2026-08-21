import { api } from '../api.js';
import { Page, LoadingRow } from '../components/Page.jsx';
import { useGuildData } from '../components/useGuildData.js';

export function Games() {
  const q = useGuildData((id) => api.stats(id));

  if (q.loading) return <Page eyebrow="section 03" title="Jeux"><LoadingRow /></Page>;

  // Agrégation par utilisateur, tous jeux confondus
  const byUser = new Map();
  const byGame = new Map();
  for (const row of q.data || []) {
    const u = byUser.get(row.user_id) || { user_id: row.user_id, total: 0, byGame: {} };
    u.total += row.wins;
    u.byGame[row.game] = (u.byGame[row.game] || 0) + row.wins;
    byUser.set(row.user_id, u);
    byGame.set(row.game, (byGame.get(row.game) || 0) + row.wins);
  }

  const leaderboard = [...byUser.values()].sort((a, b) => b.total - a.total).slice(0, 25);
  const games = [...byGame.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Page eyebrow="section 03" title="Jeux"
          description="Compteurs de victoires par joueur et par jeu. Les statistiques sont accumulées à vie.">
      {leaderboard.length === 0
        ? <div className="panel p-6 text-center text-text-dim">Aucune partie jouée sur ce serveur.</div>
        : (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            {/* Leaderboard */}
            <div className="panel overflow-hidden">
              <div className="px-4 py-3 border-b border-border h-eyebrow">Leaderboard</div>
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10 text-center">#</th>
                    <th>Joueur</th>
                    <th className="text-right">Victoires</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((u, i) => (
                    <tr key={u.user_id}>
                      <td className="text-center font-mono text-xs text-text-dim">
                        {i < 3
                          ? <span className={
                              i === 0 ? 'text-accent' :
                              i === 1 ? 'text-text' : 'text-text-dim'}>
                              {i + 1}
                            </span>
                          : i + 1}
                      </td>
                      <td className="font-mono text-xs">{u.user_id}</td>
                      <td className="text-right font-display text-xl tabular-nums">{u.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Par jeu */}
            <div className="panel overflow-hidden">
              <div className="px-4 py-3 border-b border-border h-eyebrow">Par jeu</div>
              <div className="p-4 space-y-3">
                {games.map(([game, wins]) => {
                  const max = games[0][1] || 1;
                  const pct = Math.round((wins / max) * 100);
                  return (
                    <div key={game}>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className="text-sm">{game}</div>
                        <div className="font-mono text-xs tabular-nums text-text-dim">
                          {wins.toLocaleString('fr-FR')} victoires
                        </div>
                      </div>
                      <div className="h-1 bg-panel-2 rounded overflow-hidden">
                        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
    </Page>
  );
}
