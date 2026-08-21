import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, LoadingRow } from '../components/Page.jsx';
import { useGuildData, formatRelative, formatDate } from '../components/useGuildData.js';

export function Fun() {
  const { guildId } = useParams();
  const q = useGuildData((id) => api.giveaways(id));

  return (
    <Page eyebrow="section 04" title="Fun"
          description="Giveaways passés et en cours. Force-end pour clôturer un tirage manuellement.">
      {q.loading && <LoadingRow />}
      {q.data && (q.data.length === 0
        ? <div className="panel p-6 text-center text-text-dim">Aucun giveaway.</div>
        : (
          <div className="panel overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th className="font-mono">#ID</th>
                  <th>Récompense</th>
                  <th>Hôte</th>
                  <th>État</th>
                  <th>Gagnant</th>
                  <th>Fin</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.map(g => (
                  <tr key={g.id}>
                    <td className="font-mono text-xs text-text-dim tabular-nums">#{g.id}</td>
                    <td className="font-medium">{g.prize}</td>
                    <td className="font-mono text-xs">{g.host_id}</td>
                    <td>
                      {g.ended
                        ? <span className="tag-neutral">terminé</span>
                        : <span className="tag-good">en cours</span>}
                    </td>
                    <td className="font-mono text-xs">
                      {g.winner_id ?? <span className="text-text-dim">—</span>}
                    </td>
                    <td className="text-xs text-text-dim">
                      {g.ended ? formatDate(g.ends_at) : formatRelative(g.ends_at)}
                    </td>
                    <td className="text-right">
                      {!g.ended && (
                        <button
                          className="btn-danger"
                          onClick={async () => {
                            if (!confirm(`Forcer la fin du giveaway #${g.id} ?`)) return;
                            await api.endGiveaway(guildId, g.id);
                            q.reload();
                          }}
                        >Terminer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </Page>
  );
}
