import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, LoadingRow, Stamp } from '../components/Page.jsx';
import { formatDate, formatRelative } from '../components/useGuildData.js';

export function Users() {
  const { guildId } = useParams();
  const [q, setQ]           = useState('');
  const [results, setRes]   = useState(null);
  const [picked, setPicked] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoad]  = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (!q || q.length < 2) { setRes(null); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await api.userSearch(guildId, q);
        setRes(r.items || []);
      } catch { setRes([]); }
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [q, guildId]);

  async function pick(userId) {
    setPicked(userId);
    setLoad(true);
    try { setDetail(await api.userDetail(guildId, userId)); }
    catch (e) { setDetail({ error: e.message }); }
    finally { setLoad(false); }
  }

  return (
    <Page eyebrow="section 08" title="Utilisateurs"
          description="Recherche par pseudo, ID ou tag. Voir la fiche complète : rôles, casier, warns, temp-ban, AFK, stats jeux.">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Panel gauche : search + résultats */}
        <div className="panel p-4">
          <input
            className="input mb-3"
            placeholder="Recherche… (nom, tag, ID)"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoFocus
          />
          {results && results.length === 0 && q.length >= 2 && (
            <div className="text-sm text-text-dim py-6 text-center">Aucun résultat.</div>
          )}
          <div className="space-y-1 max-h-[600px] overflow-auto">
            {(results ?? []).map(u => (
              <button
                key={u.id}
                onClick={() => pick(u.id)}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left hover:bg-panel-2
                            ${picked === u.id ? 'bg-panel-2 ring-1 ring-accent/50' : ''}`}
              >
                <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{u.displayName}</div>
                  <div className="text-[10px] font-mono text-text-dim truncate">{u.tag} · {u.id}</div>
                </div>
                {u.bot && <span className="tag-neutral">bot</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Panel droit : détail */}
        <div>
          {!picked && (
            <div className="panel py-16 text-center text-text-dim text-sm">
              Sélectionne un utilisateur à gauche pour voir sa fiche.
            </div>
          )}
          {picked && loading && <LoadingRow />}
          {picked && detail && !loading && <UserDetail detail={detail} />}
        </div>
      </div>
    </Page>
  );
}

function UserDetail({ detail }) {
  if (detail.error) {
    return <div className="panel p-6 text-center text-danger text-sm">{detail.error}</div>;
  }
  const { user, cases, warns, tempban, afk, gameStats } = detail;

  const totalWins = Object.values(gameStats || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-5 flex items-start gap-4">
        {user.avatarUrl && <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full" />}
        <div className="flex-1 min-w-0">
          <div className="font-display text-2xl">{user.displayName ?? 'Utilisateur inconnu'}</div>
          <div className="text-sm text-text-dim">{user.tag ?? '—'}</div>
          <div className="font-mono text-xs text-text-dim mt-1">{user.id}</div>
        </div>
        {user.status && (
          <span className={`tag ${user.status === 'online' ? 'tag-good' : 'tag-neutral'}`}>{user.status}</span>
        )}
      </div>

      {/* Grille compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniMetric label="Sanctions" value={cases?.length ?? 0} tone={cases?.length ? 'warn' : 'neutral'} />
        <MiniMetric label="Warns"     value={warns?.length ?? 0} tone={warns?.length ? 'warn' : 'neutral'} />
        <MiniMetric label="Temp-ban"  value={tempban ? 'actif' : '—'} tone={tempban ? 'danger' : 'neutral'} />
        <MiniMetric label="Victoires jeux" value={totalWins} tone="good" />
      </div>

      {/* Meta serveur */}
      {!user.notInGuild && (
        <div className="panel p-4 grid grid-cols-2 gap-4 text-sm">
          {user.joinedAt && (
            <div>
              <div className="h-eyebrow mb-1">Rejoint</div>
              <div>{formatDate(user.joinedAt)}</div>
            </div>
          )}
          {user.createdAt && (
            <div>
              <div className="h-eyebrow mb-1">Compte créé</div>
              <div>{formatDate(user.createdAt)}</div>
            </div>
          )}
          {user.highestRole && (
            <div>
              <div className="h-eyebrow mb-1">Rôle principal</div>
              <div style={{ color: user.highestRole.color }}>{user.highestRole.name}</div>
            </div>
          )}
          {user.boostSince && (
            <div>
              <div className="h-eyebrow mb-1">Boost depuis</div>
              <div>{formatDate(user.boostSince)}</div>
            </div>
          )}
          {tempban && (
            <div className="col-span-2">
              <div className="h-eyebrow mb-1 text-danger">Temp-ban</div>
              <div>Expire {formatRelative(tempban.expires_at)} — raison : {tempban.reason}</div>
            </div>
          )}
          {afk && (
            <div className="col-span-2">
              <div className="h-eyebrow mb-1">AFK</div>
              <div>{afk.reason} (depuis {formatRelative(afk.set_at)})</div>
            </div>
          )}
        </div>
      )}

      {/* Cases récents */}
      {cases?.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border h-eyebrow">Casier ({cases.length})</div>
          <table className="table">
            <thead>
              <tr><th>Cas</th><th>Type</th><th>Raison</th><th className="text-right">Date</th></tr>
            </thead>
            <tbody>
              {cases.slice(0, 10).map(c => (
                <tr key={c.case_id}>
                  <td><Stamp>{c.case_id}</Stamp></td>
                  <td><span className="tag-warn">{c.type}</span></td>
                  <td className="text-text-dim truncate max-w-[280px]">{c.reason}</td>
                  <td className="text-right text-xs text-text-dim">{formatRelative(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats jeux */}
      {gameStats && Object.keys(gameStats).length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border h-eyebrow">Stats jeux</div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(gameStats).sort((a, b) => b[1] - a[1]).map(([g, w]) => (
              <div key={g} className="panel-2 px-3 py-2">
                <div className="text-xs text-text-dim">{g}</div>
                <div className="font-display text-2xl tabular-nums">{w}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniMetric({ label, value, tone = 'neutral' }) {
  const color = tone === 'warn'   ? 'text-accent'
              : tone === 'danger' ? 'text-danger'
              : tone === 'good'   ? 'text-good'
              : 'text-text';
  return (
    <div className="panel px-4 py-3">
      <div className="h-eyebrow mb-1">{label}</div>
      <div className={`font-display text-2xl tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
