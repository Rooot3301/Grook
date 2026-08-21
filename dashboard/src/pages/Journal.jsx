import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Page, Stamp, LoadingRow } from '../components/Page.jsx';
import { createEventStream } from '../ws.js';
import { formatDate } from '../components/useGuildData.js';

const TABS = [
  { key: 'events', label: 'Événements' },
  { key: 'logs',   label: 'Logs système' },
];

export function Journal() {
  const [tab, setTab] = useState('events');
  return (
    <Page
      eyebrow="section 07"
      title="Journal live"
      description="Événements du bot en temps réel et logs système récents."
    >
      <div className="flex gap-1 border-b border-border mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors
                        ${tab === t.key ? 'border-accent text-text' : 'border-transparent text-text-dim hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'events' && <EventsTab />}
      {tab === 'logs'   && <SystemLogsTab />}
    </Page>
  );
}

// ─── Événements bot (WebSocket) ─────────────────────────────────────────────

const TYPE_STYLES = {
  'case:created':         { tag: 'tag-warn',    label: 'sanction' },
  'case:removed':         { tag: 'tag-neutral', label: 'sanction retirée' },
  'warn:removed':         { tag: 'tag-neutral', label: 'warn retiré' },
  'tempban:expired':      { tag: 'tag-good',    label: 'temp-ban expiré' },
  'tempban:removed':      { tag: 'tag-good',    label: 'unban dashboard' },
  'giveaway:ended':       { tag: 'tag-good',    label: 'giveaway terminé' },
  'giveaway:force-ended': { tag: 'tag-warn',    label: 'giveaway forcé' },
  'config:updated':       { tag: 'tag-neutral', label: 'config modifiée' },
  'config:reset':         { tag: 'tag-warn',    label: 'config réinitialisée' },
  'automod:updated':      { tag: 'tag-warn',    label: 'automod modifié' },
  'automod:reset':        { tag: 'tag-warn',    label: 'automod reset' },
  'channel:action':       { tag: 'tag-neutral', label: 'action canal' },
  'report:submitted':     { tag: 'tag-warn',    label: 'signalement' },
};

function EventsTab() {
  const { guildId } = useParams();
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [filterGuild, setFilterGuild] = useState(true);

  useEffect(() => {
    const stream = createEventStream();
    const off = stream.on((evt) => {
      if (evt.type === 'hello') { setConnected(true); return; }
      setEvents(prev => [evt, ...prev].slice(0, 500));
    });
    return () => { off(); stream.close(); };
  }, []);

  const visible = filterGuild
    ? events.filter(e => e.guildId === guildId || e.guildId === null)
    : events;

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-3 text-xs font-mono text-text-dim">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-good' : 'bg-danger'}`} />
        <span className="uppercase tracking-wider">{connected ? 'connecté' : 'reconnexion…'}</span>
        <button onClick={() => setFilterGuild(f => !f)} className="ml-4 btn-ghost">
          {filterGuild ? 'Serveur courant' : 'Tous serveurs'}
        </button>
      </div>

      <div className="panel divide-y divide-border">
        {visible.length === 0 && (
          <div className="py-16 text-center text-text-dim text-sm">
            <span className="pulse-dot mr-2" />
            Aucun événement encore. Le flux se remplira dès que le bot agit.
          </div>
        )}
        {visible.map((e, i) => {
          const meta = TYPE_STYLES[e.type] || { tag: 'tag-neutral', label: e.type };
          return (
            <div key={i} className="px-4 py-3 flex items-start gap-4 hover:bg-panel-2/30">
              <div className="w-32 shrink-0 font-mono text-[11px] text-text-dim tabular-nums pt-0.5">
                {formatDate(e.ts)}
              </div>
              <div className="w-40 shrink-0"><span className={meta.tag}>{meta.label}</span></div>
              <div className="flex-1 min-w-0">
                <EventBody type={e.type} data={e.data} />
              </div>
              {e.guildId && (
                <div className="font-mono text-[10px] text-text-dim/60 shrink-0 pt-1">
                  {e.guildId.slice(-6)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function EventBody({ type, data }) {
  if (type === 'case:created') {
    return (
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Stamp>{data.caseId ?? '—'}</Stamp>
        <span className="font-medium">{data.action}</span>
        <span className="text-text-dim">sur</span>
        <span className="font-mono text-xs">{data.target?.tag ?? data.target?.id}</span>
        <span className="text-text-dim">par</span>
        <span className="font-mono text-xs">{data.moderator?.tag ?? data.moderator?.id}</span>
        {data.reason && <span className="text-text-dim">— {data.reason}</span>}
      </div>
    );
  }
  if (type === 'channel:action') {
    return (
      <div className="text-sm">
        <span className="font-medium">{data.action}</span>
        {data.channel?.name && <> sur <span className="font-mono text-xs">#{data.channel.name}</span></>}
        {data.reason && <span className="text-text-dim"> — {data.reason}</span>}
      </div>
    );
  }
  if (type === 'tempban:expired' || type === 'tempban:removed') {
    return <div className="text-sm">Utilisateur <span className="font-mono text-xs">{data.userId}</span></div>;
  }
  if (type === 'giveaway:ended') {
    return (
      <div className="text-sm">
        <span className="font-medium">{data.prize}</span>
        {' — '}
        {data.winnerId
          ? <>gagné par <span className="font-mono text-xs">{data.winnerId}</span></>
          : <span className="text-text-dim">aucun participant</span>}
      </div>
    );
  }
  if (type === 'automod:updated') {
    return <div className="text-sm text-text-dim">Automod {data.enabled ? 'activé' : 'désactivé'} — seuils : mute={data.warn_mute_at ?? '—'} kick={data.warn_kick_at ?? '—'} ban={data.warn_ban_at ?? '—'}</div>;
  }
  if (type === 'report:submitted') {
    return <div className="text-sm">Signalement de <span className="font-mono text-xs">{data.target?.tag ?? data.target?.id}</span> — {data.reason}</div>;
  }
  return <pre className="text-[11px] text-text-dim font-mono overflow-hidden truncate">{JSON.stringify(data)}</pre>;
}

// ─── Logs système (ring buffer serveur) ─────────────────────────────────────

const LEVEL_TAG = {
  debug: 'tag-neutral',
  info:  'tag-good',
  warn:  'tag-warn',
  error: 'tag-danger',
};

function SystemLogsTab() {
  const [logs, setLogs]     = useState(null);
  const [level, setLevel]   = useState('debug');
  const [loading, setLoad]  = useState(false);

  async function refresh() {
    setLoad(true);
    try { setLogs((await api.systemLogs(200, level)).logs); }
    finally { setLoad(false); }
  }

  useEffect(() => { refresh(); const t = setInterval(refresh, 4_000); return () => clearInterval(t); }, [level]);

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-3">
        <div className="text-[11px] font-mono uppercase tracking-wider text-text-dim">Niveau min :</div>
        <select className="select w-28" value={level} onChange={e => setLevel(e.target.value)}>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="warn">warn</option>
          <option value="error">error</option>
        </select>
        <button className="btn-ghost" onClick={refresh} disabled={loading}>Actualiser</button>
      </div>

      <div className="panel divide-y divide-border overflow-hidden">
        {logs === null && <LoadingRow />}
        {logs?.length === 0 && (
          <div className="py-12 text-center text-text-dim text-sm">Aucun log à ce niveau.</div>
        )}
        {logs?.map((l, i) => (
          <div key={i} className="px-4 py-2 flex items-start gap-4 font-mono text-xs">
            <span className="w-32 shrink-0 text-text-dim tabular-nums">{formatDate(new Date(l.ts).getTime() / 1000)}</span>
            <span className={`w-16 shrink-0 ${LEVEL_TAG[l.level] || 'tag-neutral'} justify-center`}>{l.level}</span>
            <span className="flex-1 min-w-0 whitespace-pre-wrap break-words text-text">{l.msg}</span>
          </div>
        ))}
      </div>
    </>
  );
}
