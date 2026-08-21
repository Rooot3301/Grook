import { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { api } from './api.js';
import { Login } from './pages/Login.jsx';
import { Layout } from './components/Layout.jsx';
import { Overview } from './pages/Overview.jsx';
import { Moderation } from './pages/Moderation.jsx';
import { Games } from './pages/Games.jsx';
import { Fun } from './pages/Fun.jsx';
import { Config } from './pages/Config.jsx';
import { Automod } from './pages/Automod.jsx';
import { Journal } from './pages/Journal.jsx';

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

export function App() {
  const [session, setSession] = useState({ loading: true, user: null, guilds: [] });

  useEffect(() => {
    (async () => {
      try {
        const [user, guilds] = await Promise.all([api.me(), api.guilds()]);
        setSession({ loading: false, user, guilds });
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          setSession({ loading: false, user: null, guilds: [] });
        } else {
          setSession({ loading: false, user: null, guilds: [], error: err.message });
        }
      }
    })();
  }, []);

  if (session.loading) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <div className="flex items-center gap-3 text-text-dim">
          <span className="pulse-dot" />
          <span className="font-mono text-xs uppercase tracking-widest">chargement…</span>
        </div>
      </div>
    );
  }

  if (!session.user) return <Login />;

  return (
    <SessionContext.Provider value={{ ...session, setSession }}>
      <Routes>
        <Route path="/" element={<PickFirstGuild guilds={session.guilds} />} />
        <Route path="/g/:guildId" element={<Layout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview"    element={<Overview />} />
          <Route path="moderation"  element={<Moderation />} />
          <Route path="games"       element={<Games />} />
          <Route path="fun"         element={<Fun />} />
          <Route path="config"      element={<Config />} />
          <Route path="automod"     element={<Automod />} />
          <Route path="journal"     element={<Journal />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionContext.Provider>
  );
}

function PickFirstGuild({ guilds }) {
  if (!guilds.length) {
    return (
      <div className="h-screen grid place-items-center px-6 text-center">
        <div className="max-w-md">
          <div className="h-eyebrow mb-2">état</div>
          <h1 className="h-display text-2xl mb-3">Le bot n'est encore présent sur aucun serveur.</h1>
          <p className="text-text-dim">Invite Grook sur un serveur Discord pour que ce dashboard prenne vie.</p>
        </div>
      </div>
    );
  }
  return <Navigate to={`/g/${guilds[0].id}/overview`} replace />;
}
