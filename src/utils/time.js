/**
 * Convertit une chaîne de durée en millisecondes.
 * Formats acceptés : 10s, 5m, 2h, 1d, 1w
 * Retourne null si invalide.
 * @param {string} str
 * @returns {number|null}
 */
export function parseDuration(str) {
  if (!str) return null;
  const match = /^([0-9]+)\s*([smhdw])$/i.exec(str.trim());
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (isNaN(value) || value <= 0) return null;
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  return value * multipliers[match[2].toLowerCase()];
}

// setTimeout est un int32 signé : au-delà de ~24.8 jours, il déborde et se
// déclenche immédiatement. Ce helper enchaîne des timers courts pour rester exact.
const MAX_SAFE_TIMEOUT = 2_147_483_647;

/**
 * setTimeout qui tolère les délais > 24 jours (chaîne des timers).
 * Retourne un handle { cancel() } utilisable pour annuler.
 * @param {number} delayMs
 * @param {() => void} callback
 */
export function safeSetTimeout(delayMs, callback) {
  const handle = { cancelled: false, tid: null };
  const schedule = (remaining) => {
    if (handle.cancelled) return;
    const step = Math.min(Math.max(0, remaining), MAX_SAFE_TIMEOUT);
    handle.tid = setTimeout(() => {
      if (handle.cancelled) return;
      const next = remaining - step;
      if (next <= 0) callback();
      else schedule(next);
    }, step);
    handle.tid.unref?.();
  };
  schedule(delayMs);
  return { cancel() { handle.cancelled = true; clearTimeout(handle.tid); } };
}

/**
 * Formate une durée en millisecondes en texte lisible.
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  const units = [
    { label: 'semaine',  ms: 604_800_000 },
    { label: 'jour',     ms: 86_400_000 },
    { label: 'heure',    ms: 3_600_000 },
    { label: 'minute',   ms: 60_000 },
    { label: 'seconde',  ms: 1_000 },
  ];
  for (const { label, ms: unitMs } of units) {
    if (ms >= unitMs) {
      const val = Math.floor(ms / unitMs);
      return `${val} ${label}${val > 1 ? 's' : ''}`;
    }
  }
  return `${ms}ms`;
}
