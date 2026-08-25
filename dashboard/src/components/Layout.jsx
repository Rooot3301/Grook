import { useEffect, useState } from 'react';
import { Outlet, NavLink, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../App.jsx';
import { createEventStream } from '../ws.js';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import { GlobalSearch } from './GlobalSearch.jsx';
import { tryNotify } from '../theme.js';

const NAV = [
  { n: '01', to: 'overview',   label: 'Aperçu' },
  { n: '02', to: 'moderation', label: 'Modération' },
  { n: '03', to: 'games',      label: 'Jeux' },
  { n: '04', to: 'fun',        label: 'Fun' },
  { n: '05', to: 'config',     label: 'Configuration' },
  { n: '06', to: 'automod',    label: 'Automod' },
  { n: '07', to: 'users',      label: 'Utilisateurs' },
  { n: '08', to: 'journal',    label: 'Journal live' },
  { n: '09', to: 'settings',   label: 'Réglages' },
];

export function Layout() {
  const { guildId } = useParams();
  const { user, guilds } = useSession();
  const navigate = useNavigate();
  const guild = guilds.find(g => g.id === guildId);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    const stream = createEventStream();
    const off = stream.on((evt) => {
      if (evt.type === 'hello') return;
      setLastEvent(evt);
      // Push notification navigateur si l'utilisateur a activé ce type
      // dans les Réglages (localStorage-based).
      tryNotify(evt);
    });
    return () => { off(); stream.close(); };
  }, []);

  if (!guild) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <div className="h-eyebrow mb-2">introuvable</div>
          <p className="text-text-dim">Ce serveur n'est plus accessible au bot.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside className="border-r border-border bg-panel flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="h-eyebrow">registre</div>
          <div className="font-display text-xl mt-0.5">Grook</div>
        </div>

        <nav className="p-2 flex-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-baseline gap-3 px-3 py-2 rounded-md transition-colors
                 ${isActive ? 'bg-panel-2 text-text' : 'text-text-dim hover:text-text hover:bg-panel-2/50'}`
              }
            >
              <span className="nav-num">{item.n}</span>
              <span className="text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Persona indicator */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="pulse-dot" />
            <span className="text-xs font-mono text-text-dim uppercase tracking-wider">
              Grook · en observation
            </span>
          </div>
          {lastEvent && (
            <div className="text-[11px] font-mono text-text-dim/70 truncate">
              ↳ {lastEvent.type}
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN COL ────────────────────────────────────────────────────── */}
      <div className="flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between gap-4 px-6 bg-panel/50 backdrop-blur">
          <GuildSwitcher
            current={guild}
            guilds={guilds}
            onPick={(id) => navigate(`/g/${id}/overview`)}
          />
          <div className="flex-1 flex justify-center">
            <GlobalSearch />
          </div>
          <UserBadge user={user} />
        </header>

        {/* Content — wrappé dans un ErrorBoundary keyé sur la route pour
             que le crash d'une page ne blanchisse pas le dashboard entier. */}
        <main className="flex-1 overflow-auto">
          <RoutedErrorBoundary />
        </main>
      </div>
    </div>
  );
}

/**
 * Wrapper qui remonte le boundary à chaque changement de route.
 * Sinon, une fois une page crashée, cliquer sur une autre entrée sidebar
 * garderait le message d'erreur.
 */
function RoutedErrorBoundary() {
  const loc = useLocation();
  return (
    <ErrorBoundary key={loc.pathname}>
      <Outlet />
    </ErrorBoundary>
  );
}

function GuildSwitcher({ current, guilds, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-3 px-2 py-1 rounded-md hover:bg-panel-2"
      >
        {current.iconUrl
          ? <img src={current.iconUrl} alt="" className="w-7 h-7 rounded-md" />
          : <div className="w-7 h-7 rounded-md bg-panel-2 grid place-items-center text-xs font-mono">
              {current.name.slice(0, 2).toUpperCase()}
            </div>}
        <div className="text-left">
          <div className="text-sm font-medium leading-tight">{current.name}</div>
          <div className="text-[11px] font-mono text-text-dim tabular-nums">
            {current.memberCount.toLocaleString('fr-FR')} membres
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-text-dim ml-1">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && guilds.length > 1 && (
        <div className="absolute top-full left-0 mt-1 w-72 panel py-1 z-20">
          {guilds.map(g => (
            <button
              key={g.id}
              onClick={() => { setOpen(false); onPick(g.id); }}
              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-panel-2 text-left
                          ${g.id === current.id ? 'text-accent' : 'text-text'}`}
            >
              {g.iconUrl
                ? <img src={g.iconUrl} alt="" className="w-6 h-6 rounded" />
                : <div className="w-6 h-6 rounded bg-panel-2 grid place-items-center text-[10px] font-mono">
                    {g.name.slice(0, 2).toUpperCase()}
                  </div>}
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{g.name}</div>
                <div className="text-[10px] font-mono text-text-dim tabular-nums">
                  {g.memberCount.toLocaleString('fr-FR')} · {g.id}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBadge({ user }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm">{user.username}</div>
        <button
          onClick={async () => {
            await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/';
          }}
          className="text-[11px] font-mono text-text-dim hover:text-danger uppercase tracking-wider"
        >
          se déconnecter
        </button>
      </div>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
        : <div className="w-8 h-8 rounded-full bg-panel-2 grid place-items-center text-xs font-mono">
            {user.username?.[0]?.toUpperCase() ?? '?'}
          </div>}
    </div>
  );
}
