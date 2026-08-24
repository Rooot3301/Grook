import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, Stamp, LoadingRow } from '../components/Page.jsx';
import { useGuildData, formatDate, formatRelative } from '../components/useGuildData.js';

const TABS = [
  { key: 'cases',    label: 'Casier' },
  { key: 'warnings', label: 'Avertissements' },
  { key: 'tempbans', label: 'Temp-bans actifs' },
];

export function Moderation() {
  const [tab, setTab] = useState('cases');
  return (
    <Page eyebrow="section 02" title="Modération"
          description="Historique des sanctions, avertissements et bannissements temporaires.">
      <div className="flex gap-1 border-b border-border mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors
                        ${tab === t.key
                          ? 'border-accent text-text'
                          : 'border-transparent text-text-dim hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'cases'    && <CasesTab />}
      {tab === 'warnings' && <WarningsTab />}
      {tab === 'tempbans' && <TempBansTab />}
    </Page>
  );
}

function CasesTab() {
  const { guildId } = useParams();
  const q = useGuildData((id) => api.cases(id).then(r => r.items ?? r));
  if (q.loading) return <LoadingRow />;
  if (!q.data?.length) return <div className="panel p-6 text-center text-text-dim">Aucune sanction enregistrée.</div>;

  return (
    <div className="panel overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Casier</th><th>Type</th><th>Utilisateur</th>
            <th>Modérateur</th><th>Raison</th><th className="text-right">Date</th><th />
          </tr>
        </thead>
        <tbody>
          {q.data.map(c => (
            <tr key={c.case_id}>
              <td><Stamp>{c.case_id}</Stamp></td>
              <td><span className="tag-warn">{c.type}</span></td>
              <td className="font-mono text-xs">{c.user_id}</td>
              <td className="font-mono text-xs text-text-dim">{c.moderator_id}</td>
              <td className="text-text truncate max-w-[280px]">{c.reason}</td>
              <td className="text-right text-xs text-text-dim whitespace-nowrap">{formatDate(c.created_at)}</td>
              <td className="text-right">
                <button
                  className="btn-icon"
                  title="Supprimer ce cas"
                  onClick={async () => {
                    if (!confirm(`Supprimer le cas ${c.case_id} ?`)) return;
                    await api.removeCase(guildId, c.case_id);
                    q.reload();
                  }}
                >✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WarningsTab() {
  const { guildId } = useParams();
  const q = useGuildData((id) => api.warnings(id).then(r => r.items ?? r));
  if (q.loading) return <LoadingRow />;
  if (!q.data?.length) return <div className="panel p-6 text-center text-text-dim">Aucun avertissement.</div>;

  return (
    <div className="panel overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th className="font-mono">#ID</th>
            <th>Utilisateur</th><th>Modérateur</th><th>Raison</th>
            <th className="text-right">Date</th><th />
          </tr>
        </thead>
        <tbody>
          {q.data.map(w => (
            <tr key={w.id}>
              <td className="font-mono text-xs text-text-dim tabular-nums">#{w.id}</td>
              <td className="font-mono text-xs">{w.user_id}</td>
              <td className="font-mono text-xs text-text-dim">{w.moderator_id}</td>
              <td className="text-text truncate max-w-[280px]">{w.reason}</td>
              <td className="text-right text-xs text-text-dim whitespace-nowrap">{formatDate(w.created_at)}</td>
              <td className="text-right">
                <button
                  className="btn-icon"
                  onClick={async () => {
                    if (!confirm(`Retirer l'avertissement #${w.id} ?`)) return;
                    await api.removeWarn(guildId, w.id);
                    q.reload();
                  }}
                >✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TempBansTab() {
  const { guildId } = useParams();
  const q = useGuildData((id) => api.tempbans(id));
  if (q.loading) return <LoadingRow />;
  if (!q.data?.length) return <div className="panel p-6 text-center text-text-dim">Aucun temp-ban actif.</div>;

  return (
    <div className="panel overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>Utilisateur</th><th>Modérateur</th><th>Raison</th>
            <th>Créé</th><th>Expire</th><th />
          </tr>
        </thead>
        <tbody>
          {q.data.map(b => (
            <tr key={b.user_id}>
              <td className="font-mono text-xs">{b.user_id}</td>
              <td className="font-mono text-xs text-text-dim">{b.moderator_id}</td>
              <td className="text-text truncate max-w-[240px]">{b.reason}</td>
              <td className="text-xs text-text-dim">{formatDate(b.created_at)}</td>
              <td className="text-xs">{formatRelative(b.expires_at)}</td>
              <td className="text-right">
                <button
                  className="btn-danger"
                  onClick={async () => {
                    if (!confirm(`Débannir l'utilisateur ${b.user_id} maintenant ?`)) return;
                    await api.unbanUser(guildId, b.user_id, 'Unban depuis dashboard');
                    q.reload();
                  }}
                >Débannir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
