import { ActivityType } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { VERSION } from '../version.js';
import { logger } from '../utils/logger.js';

const { Watching, Playing, Listening } = ActivityType;

/**
 * Statuts *informationnels* — le rich presence est utilisé comme mini-panneau
 * de télémétrie, pas comme vitrine humoristique. Chaque statut rapporte une
 * vraie métrique du bot.
 */
const STATUSES = [
  // Version
  () => ({ type: Watching, text: `Grook v${VERSION}` }),

  // Serveurs surveillés
  (c) => ({ type: Watching, text: `${c.guilds.cache.size} serveur${c.guilds.cache.size > 1 ? 's' : ''}` }),

  // Membres cumulés
  (c) => {
    const total = c.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    return { type: Watching, text: `${total.toLocaleString('fr-FR')} membres` };
  },

  // Uptime process
  () => {
    const s = Math.floor(process.uptime());
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return { type: Playing, text: `Uptime ${d}j ${h % 24}h` };
    if (h > 0) return { type: Playing, text: `Uptime ${h}h ${m % 60}min` };
    if (m > 0) return { type: Playing, text: `Uptime ${m}min` };
    return null;
  },

  // Mémoire heap
  () => {
    const mb = process.memoryUsage().heapUsed / 1024 / 1024;
    return { type: Playing, text: `${mb.toFixed(0)} MB RAM` };
  },

  // Taille de la DB
  () => {
    try {
      const dbPath = path.resolve('data', 'grook.db');
      const size   = fs.statSync(dbPath).size;
      const mb     = size / 1024 / 1024;
      return { type: Watching, text: `DB ${mb.toFixed(1)} MB` };
    } catch { return null; }
  },

  // Latence WebSocket
  (c) => {
    const ping = c.ws.ping;
    if (ping <= 0) return null;
    return { type: Listening, text: `Gateway ${ping} ms` };
  },
];

let cursor = 0;

function nextStatus(client) {
  const resolved = STATUSES
    .map((fn, i) => { try { return { i, s: fn(client) }; } catch { return { i, s: null }; } })
    .filter(x => x.s);
  if (!resolved.length) return null;
  const status = resolved[cursor % resolved.length].s;
  cursor++;
  return status;
}

/**
 * Démarre la rotation. Intervalle défini par PRESENCE_INTERVAL_MIN (défaut 5 min).
 */
export function startRichPresenceRotation(client) {
  const intervalMin = Math.max(1, parseFloat(process.env.PRESENCE_INTERVAL_MIN) || 5);
  const intervalMs  = intervalMin * 60 * 1000;

  function rotate() {
    try {
      const status = nextStatus(client);
      if (!status) return;
      client.user?.setPresence({
        activities: [{ name: status.text, type: status.type }],
        status: 'online',
      });
    } catch (err) {
      logger.warn(`[richPresence] Erreur : ${err.message}`);
    }
  }

  rotate();
  const interval = setInterval(rotate, intervalMs);
  interval.unref?.();

  logger.info(`[richPresence] Rotation active — ${STATUSES.length} statuts, toutes les ${intervalMin} min`);
}
