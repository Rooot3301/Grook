import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, LoadingRow, Stamp } from '../components/Page.jsx';
import { useGuildData, formatRelative } from '../components/useGuildData.js';

export function Overview() {
  const { guildId } = useParams();
  const cases     = useGuildData((id) => api.cases(id).then(r => (r.items ?? r).slice(0, 6)));
  const tempbans  = useGuildData((id) => api.tempbans(id));
  const giveaways = useGuildData((id) => api.giveaways(id).then(a => a.filter(g => !g.ended)));

  return (
    <Page eyebrow="section 01" title="Aperçu">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Metric label="Sanctions totales" value={cases.data?.length ?? '—'} tone="warn"   loading={cases.loading} />
        <Metric label="Temp-bans actifs"  value={tempbans.data?.length ?? '—'} tone="danger" loading={tempbans.loading} />
        <Metric label="Giveaways en cours" value={giveaways.data?.length ?? '—'} tone="good" loading={giveaways.loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Dernières sanctions" moreTo={`/g/${guildId}/moderation`}>
          {cases.loading && <LoadingRow />}
          {cases.error && <ErrorHint />}
          {cases.data && (cases.data.length === 0
            ? <EmptyRow>Aucune sanction consignée.</EmptyRow>
            : (
              <table className="table">
                <thead>
                  <tr><th>Casier</th><th>Type</th><th>Cible</th><th className="text-right">Date</th></tr>
                </thead>
                <tbody>
                  {cases.data.map(c => (
                    <tr key={c.case_id}>
                      <td><Stamp>{c.case_id}</Stamp></td>
                      <td><span className="tag-warn">{c.type}</span></td>
                      <td className="font-mono text-xs">{c.user_id}</td>
                      <td className="text-right text-text-dim text-xs">{formatRelative(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </Panel>

        <Panel title="Temp-bans à venir" moreTo={`/g/${guildId}/moderation`}>
          {tempbans.loading && <LoadingRow />}
          {tempbans.data && (tempbans.data.length === 0
            ? <EmptyRow>Aucun temp-ban actif.</EmptyRow>
            : (
              <table className="table">
                <thead>
                  <tr><th>Utilisateur</th><th>Raison</th><th className="text-right">Expire</th></tr>
                </thead>
                <tbody>
                  {tempbans.data.slice(0, 6).map(b => (
                    <tr key={b.user_id}>
                      <td className="font-mono text-xs">{b.user_id}</td>
                      <td className="text-text-dim truncate max-w-[240px]">{b.reason}</td>
                      <td className="text-right text-xs">{formatRelative(b.expires_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </Panel>
      </div>
    </Page>
  );
}

function Metric({ label, value, tone = 'neutral', loading }) {
  return (
    <div className="panel px-5 py-4">
      <div className="h-eyebrow mb-2">{label}</div>
      <div className={`font-display text-4xl tabular-nums ${
        tone === 'warn'   ? 'text-accent' :
        tone === 'danger' ? 'text-danger' :
        tone === 'good'   ? 'text-good'   : 'text-text'
      }`}>
        {loading ? '···' : value}
      </div>
    </div>
  );
}

function Panel({ title, children, moreTo }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="h-eyebrow">{title}</div>
        {moreTo && (
          <Link to={moreTo} className="text-[11px] font-mono text-text-dim hover:text-accent uppercase tracking-wider">
            voir tout →
          </Link>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyRow({ children }) {
  return <div className="py-8 text-center text-sm text-text-dim">{children}</div>;
}
function ErrorHint() {
  return <div className="py-6 text-center text-sm text-danger">Impossible de charger — réessaie.</div>;
}
