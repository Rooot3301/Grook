import { useEffect, useState } from 'react';
import { Page } from '../components/Page.jsx';
import {
  getTheme, setTheme,
  getNotifPrefs, setNotifPref,
  requestNotifPermission, NOTIF_TYPES,
} from '../theme.js';

export function Settings() {
  const [theme, setThemeState]   = useState(getTheme());
  const [prefs, setPrefs]         = useState(getNotifPrefs());
  const [permission, setPerm]     = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  useEffect(() => { setTheme(theme); }, [theme]);

  async function togglePref(key) {
    const next = !prefs[key];
    setNotifPref(key, next);
    setPrefs({ ...prefs, [key]: next });
    if (next && permission !== 'granted') {
      const result = await requestNotifPermission();
      setPerm(result);
    }
  }

  return (
    <Page eyebrow="section 09" title="Réglages"
          description="Préférences locales — stockées uniquement dans ton navigateur.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Thème */}
        <div className="panel p-5">
          <div className="text-sm font-medium mb-1">Thème</div>
          <p className="text-xs text-text-dim mb-4 leading-relaxed">
            Bascule entre thème sombre (défaut) et clair. Le clair est encore en rodage —
            certaines surfaces peuvent rester sombres.
          </p>
          <div className="flex gap-2">
            <button
              className={`flex-1 py-3 rounded-md border transition-colors
                          ${theme === 'dark' ? 'border-accent bg-accent/10' : 'border-border hover:bg-panel-2'}`}
              onClick={() => setThemeState('dark')}
            >
              🌙 <span className="ml-2 text-sm">Sombre</span>
            </button>
            <button
              className={`flex-1 py-3 rounded-md border transition-colors
                          ${theme === 'light' ? 'border-accent bg-accent/10' : 'border-border hover:bg-panel-2'}`}
              onClick={() => setThemeState('light')}
            >
              ☀️ <span className="ml-2 text-sm">Clair</span>
            </button>
          </div>
        </div>

        {/* Notifs */}
        <div className="panel p-5">
          <div className="text-sm font-medium mb-1">Notifications navigateur</div>
          <p className="text-xs text-text-dim mb-4 leading-relaxed">
            Reçois une notification système quand un événement du bus tombe (case, tempban expiré, giveaway, anti-scam, signalement).
            La permission t'est demandée au premier toggle activé.
          </p>
          <div className="mb-3 text-[11px] font-mono uppercase tracking-wider text-text-dim">
            État : {permission === 'granted' ? '✅ Autorisé' : permission === 'denied' ? '⛔ Refusé (change dans les réglages du navigateur)' : '⚪ Non demandé'}
          </div>
          <div className="space-y-2">
            {NOTIF_TYPES.map(t => (
              <label key={t.key} className="flex items-center gap-3 cursor-pointer hover:bg-panel-2 -mx-2 px-2 py-1 rounded">
                <input
                  type="checkbox"
                  checked={!!prefs[t.key]}
                  onChange={() => togglePref(t.key)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm">{t.label}</span>
                <code className="ml-auto text-[10px] font-mono text-text-dim">{t.key}</code>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="panel p-5 mt-6">
        <div className="text-sm font-medium mb-1">À propos</div>
        <p className="text-xs text-text-dim leading-relaxed">
          Ces réglages sont stockés dans <code className="font-mono">localStorage</code> — ils ne quittent jamais ton navigateur.
          Si tu changes d'appareil, tu devras les reconfigurer.
        </p>
      </div>
    </Page>
  );
}
