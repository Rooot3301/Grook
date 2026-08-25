import fastifyWebsocket from '@fastify/websocket';
import { bus } from './events.js';
import { logger, logEmitter } from '../utils/logger.js';

/**
 * Routes WebSocket du dashboard.
 *
 * - /ws        → flux d'événements métier bot -> dashboard (via bus).
 * - /ws/logs   → flux des logs système en direct (via logEmitter du logger).
 *
 * Chaque route est protégée par le cookie de session (BOT_OWNER_ID).
 *
 * @fastify/websocket v10+ passe le socket directement (pas `connection.socket`).
 */
export async function registerWebSocket(fastify) {
  await fastify.register(fastifyWebsocket);

  fastify.get('/ws', {
    websocket: true,
    preHandler: fastify.requireOwner,
  }, (socket, _request) => {
    const s = socket?.socket ?? socket;
    const listener = (evt) => {
      if (s.readyState !== 1) return;
      try { s.send(JSON.stringify(evt)); }
      catch (err) { logger.warn('[ws] send échoué :', err.message); }
    };
    bus.on('event', listener);
    try { s.send(JSON.stringify({ type: 'hello', ts: Math.floor(Date.now() / 1000) })); } catch { /* ignore */ }
    s.on('close', () => bus.off('event', listener));
    s.on('error', () => bus.off('event', listener));
  });

  // ── /ws/logs ────────────────────────────────────────────────────────────
  // Push des logs système en temps réel. Client peut envoyer un JSON
  // { minLevel: 'debug' | 'info' | 'warn' | 'error' } pour filtrer.
  fastify.get('/ws/logs', {
    websocket: true,
    preHandler: fastify.requireOwner,
  }, (socket, _request) => {
    const s = socket?.socket ?? socket;
    let minLevel = 'debug';
    const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };

    const listener = (entry) => {
      if (s.readyState !== 1) return;
      if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[minLevel]) return;
      try { s.send(JSON.stringify(entry)); } catch { /* ignore */ }
    };
    logEmitter.on('log', listener);

    s.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.minLevel && msg.minLevel in LEVEL_ORDER) minLevel = msg.minLevel;
      } catch { /* ignore */ }
    });
    s.on('close', () => logEmitter.off('log', listener));
    s.on('error', () => logEmitter.off('log', listener));
  });
}
