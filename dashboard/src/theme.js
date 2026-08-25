/**
 * Gestion du thème dark/light via l'attribut data-theme sur <html>.
 * Persisté dans localStorage. Défaut : 'dark'.
 *
 * Le CSS dans styles.css lit ces variables et bascule la palette.
 */
const STORAGE_KEY = 'grook.theme';

export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  return 'dark';
}

export function setTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
}

export function applyThemeFromStorage() {
  setTheme(getTheme());
}

// ─── Notifs prefs ─────────────────────────────────────────────────────────────

const NOTIF_KEY = 'grook.notifs';

export const NOTIF_TYPES = [
  { key: 'case:created',    label: 'Nouvelle sanction (case:created)' },
  { key: 'tempban:expired', label: 'Temp-ban expiré' },
  { key: 'giveaway:ended',  label: 'Giveaway terminé' },
  { key: 'antiscam:hit',    label: 'Anti-scam a agi' },
  { key: 'report:submitted',label: 'Nouveau signalement' },
];

export function getNotifPrefs() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
  } catch { return {}; }
}

export function setNotifPref(key, enabled) {
  const p = getNotifPrefs();
  p[key] = enabled;
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export async function requestNotifPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  return Notification.requestPermission();
}

export function tryNotify(evt) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const prefs = getNotifPrefs();
  if (!prefs[evt.type]) return;

  const title = evt.type;
  const body = summarizeEvent(evt);
  try { new Notification(`Grook · ${title}`, { body, silent: false, tag: `grook-${evt.type}` }); }
  catch { /* ignore */ }
}

function summarizeEvent(evt) {
  const d = evt.data || {};
  if (evt.type === 'case:created') return `${d.action ?? '?'} sur ${d.target?.tag ?? '?'} par ${d.moderator?.tag ?? '?'}`;
  if (evt.type === 'tempban:expired') return `Utilisateur ${d.userId ?? '?'}`;
  if (evt.type === 'giveaway:ended') return `${d.prize ?? 'Prix'} — ${d.winnerId ? 'gagné' : 'aucun gagnant'}`;
  if (evt.type === 'antiscam:hit') return `Message supprimé de ${d.author?.tag ?? '?'} (score ${d.score})`;
  if (evt.type === 'report:submitted') return `${d.target?.tag ?? '?'} — ${d.reason ?? ''}`;
  return JSON.stringify(d).slice(0, 100);
}
