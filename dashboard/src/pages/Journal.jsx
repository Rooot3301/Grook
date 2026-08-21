import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Page, Stamp } from '../components/Page.jsx';
import { createEventStream } from '../ws.js';
import { formatDate } from '../components/useGuildData.js';

const TYPE_STYLES = {
  'case:created':      { tag: 'tag-warn',    label: 'sanction' },
  'case:removed':      { tag: 'tag-neutral', label: 'sanction retirée' },
  'warn:removed':      { tag: 'tag-neutral', label: 'warn retiré' },
  'tempban:expired':   { tag: 'tag-good',    label: 'temp-ban expiré' },
  'tempban:removed':   { tag: 'tag-good',    label: 'unban dashboard' },
  'giveaway:ended':    { tag: 'tag-good',    label: 'giveaway terminé' },
  'giveaway:force-ended': { tag: 'tag-warn', label: 'giveaway forcé' },
  'config:updated':    { tag: 'tag-neutral', label: 'config modifiée' },
  'config:reset':      { tag: 'tag-warn',    label: 'config réinitialisée' },
};

export function Journal() {
  const { guildId } = useParams();
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [filterGuild, setFilterGuild] = useState(true);
  const scrollRef = useRef(null);

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
    <Page
      eyebrow="section 06"
      title="Journal live"
      description="Flux temps réel des événements du bot. Se remplit dès qu'une action est consignée."
      actions={
        <div className="flex items-center gap-2 text-xs font-mono text-text-dim">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-good' : 'bg-danger'}`} />
          <span className="uppercase tracking-wider">{connected ? 'connecté' : 'reconnexion…'}</span>
          <button
            onClick={() => setFilterGuild(f => !f)}
            className="ml-4 btn-ghost"
          >
            {filterGuild ? 'Serveur courant seulement' : 'Tous serveurs'}
          </button>
        </div>
      }
    >
      <div className="panel divide-y divide-border" ref={scrollRef}>
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
              <div className="w-40 shrink-0">
                <span className={meta.tag}>{meta.label}</span>
              </div>
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
    </Page>
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
  if (type === 'tempban:expired') {
    return <div className="text-sm">Temp-ban expiré — <span className="font-mono text-xs">{data.userId}</span></div>;
  }
  if (type === 'tempban:removed') {
    return <div className="text-sm">Unban depuis dashboard — <span className="font-mono text-xs">{data.userId}</span></div>;
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
  if (type === 'config:updated') {
    return (
      <div className="text-sm">
        <span className="font-mono text-xs text-text-dim">
          {Object.keys(data).join(', ')}
        </span>
      </div>
    );
  }
  return <pre className="text-[11px] text-text-dim font-mono overflow-hidden truncate">{JSON.stringify(data)}</pre>;
}
