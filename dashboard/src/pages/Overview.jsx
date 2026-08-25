import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, LoadingRow, Stamp } from '../components/Page.jsx';
import { useGuildData, formatRelative } from '../components/useGuildData.js';

export function Overview() {
  const { guildId } = useParams();
  // On charge TOUT le casier pour les graphs (limité côté backend à 500).
  const cases     = useGuildData((id) => api.cases(id).then(r => r.items ?? r));
  const tempbans  = useGuildData((id) => api.tempbans(id));
  const giveaways = useGuildData((id) => api.giveaways(id).then(a => a.filter(g => !g.ended)));

  const recentCases = (cases.data ?? []).slice(0, 6);

  return (
    <Page eyebrow="section 01" title="Aperçu">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Metric label="Sanctions totales" value={cases.data?.length ?? '—'} tone="warn"   loading={cases.loading} />
        <Metric label="Temp-bans actifs"  value={tempbans.data?.length ?? '—'} tone="danger" loading={tempbans.loading} />
        <Metric label="Giveaways en cours" value={giveaways.data?.length ?? '—'} tone="good" loading={giveaways.loading} />
      </div>

      {/* ── Graphs ─────────────────────────────────────────────────────────── */}
      {cases.data && cases.data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mb-6">
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-border h-eyebrow">Sanctions par jour (30j)</div>
            <div className="p-4">
              <BarChartDaily items={cases.data} days={30} />
            </div>
          </div>
          <div className="panel overflow-hidden">
            <div className="px-4 py-3 border-b border-border h-eyebrow">Par type</div>
            <div className="p-4">
              <TypeDistribution items={cases.data} />
            </div>
          </div>
        </div>
      )}

      {cases.data && cases.data.length > 0 && (
        <div className="panel overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border h-eyebrow">Top 5 utilisateurs sanctionnés</div>
          <TopUsers items={cases.data} guildId={guildId} />
        </div>
      )}

      {/* ── Tables résumées ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Dernières sanctions" moreTo={`/g/${guildId}/moderation`}>
          {cases.loading && <LoadingRow />}
          {cases.data && (recentCases.length === 0
            ? <EmptyRow>Aucune sanction consignée.</EmptyRow>
            : (
              <table className="table">
                <thead>
                  <tr><th>Casier</th><th>Type</th><th>Cible</th><th className="text-right">Date</th></tr>
                </thead>
                <tbody>
                  {recentCases.map(c => (
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

// ─── Bar chart SVG : sanctions par jour ─────────────────────────────────────
function BarChartDaily({ items, days = 30 }) {
  const now = Math.floor(Date.now() / 1000);
  const dayS = 86_400;
  const buckets = new Array(days).fill(0);
  const dayStart = Math.floor(now / dayS) * dayS - (days - 1) * dayS;

  for (const c of items) {
    if (c.created_at < dayStart) continue;
    const idx = Math.floor((c.created_at - dayStart) / dayS);
    if (idx >= 0 && idx < days) buckets[idx]++;
  }

  const max = Math.max(1, ...buckets);
  const W   = 720, H = 180, PAD = 24;
  const barW = (W - PAD * 2) / days;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {buckets.map((v, i) => {
        const h = (v / max) * (H - PAD * 2);
        const x = PAD + i * barW + 1;
        const y = H - PAD - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW - 2} height={h}
                  className={v > 0 ? 'fill-accent/80' : 'fill-border'} />
          </g>
        );
      })}
      {/* Axe : min et max */}
      <text x={PAD} y={16} className="fill-text-dim" fontSize="10" fontFamily="monospace">max {max}</text>
      <text x={PAD} y={H - 6} className="fill-text-dim" fontSize="10" fontFamily="monospace">il y a {days} jours</text>
      <text x={W - PAD} y={H - 6} textAnchor="end" className="fill-text-dim" fontSize="10" fontFamily="monospace">aujourd&apos;hui</text>
    </svg>
  );
}

// ─── Distribution par type — barres horizontales ────────────────────────────
function TypeDistribution({ items }) {
  const byType = new Map();
  for (const c of items) byType.set(c.type, (byType.get(c.type) || 0) + 1);
  const list = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  const max = list[0]?.[1] || 1;

  return (
    <div className="space-y-2">
      {list.map(([type, count]) => {
        const pct = Math.round((count / max) * 100);
        return (
          <div key={type}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="font-mono uppercase">{type}</span>
              <span className="font-mono tabular-nums text-text-dim">{count}</span>
            </div>
            <div className="h-1.5 bg-panel-2 rounded overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Top 5 utilisateurs sanctionnés ─────────────────────────────────────────
function TopUsers({ items, guildId }) {
  const byUser = new Map();
  for (const c of items) byUser.set(c.user_id, (byUser.get(c.user_id) || 0) + 1);
  const top = [...byUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <table className="table">
      <thead><tr><th>#</th><th>Utilisateur</th><th className="text-right">Cas</th></tr></thead>
      <tbody>
        {top.map(([userId, count], i) => (
          <tr key={userId}>
            <td className="text-center font-mono text-xs text-text-dim">{i + 1}</td>
            <td>
              <Link to={`/g/${guildId}/users`} className="font-mono text-xs hover:text-accent">
                {userId}
              </Link>
            </td>
            <td className="text-right font-display text-xl tabular-nums text-accent">{count}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
