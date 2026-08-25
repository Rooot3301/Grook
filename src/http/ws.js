import fastifyWebsocket from '@fastify/websocket';
import { bus } from './events.js';
import { logger } from '../utils/logger.js';

/**
 * Route /ws — flux d'événements bot -> dashboard.
 *
 * L'utilisateur doit être connecté (cookie de session valide et = BOT_OWNER_ID).
 * Chaque connexion reçoit tous les events publiés sur le bus interne.
 *
 * Protocole : messages JSON { type, guildId, data, ts }
 *
 * @fastify/websocket v10+ passe le socket directement (pas `connection.socket`).
 */
export async function registerWebSocket(fastify) {
  await fastify.register(fastifyWebsocket);

  fastify.get('/ws', {
    websocket: true,
    preHandler: fastify.requireOwner,
  }, (socket /* v10 : socket direct */, _request) => {
    // Rétrocompat : si on reçoit encore l'ancien { socket } wrapper, on unwrap.
    const s = socket?.socket ?? socket;

    const listener = (evt) => {
      if (s.readyState !== 1 /* OPEN */) return;
      try { s.send(JSON.stringify(evt)); }
      catch (err) { logger.warn('[ws] send échoué :', err.message); }
    };
    bus.on('event', listener);

    try { s.send(JSON.stringify({ type: 'hello', ts: Math.floor(Date.now() / 1000) })); }
    catch { /* ignore */ }

    s.on('close', () => bus.off('event', listener));
    s.on('error', (err) => {
      logger.warn(`[ws] socket error : ${err.message}`);
      bus.off('event', listener);
    });
  });
}
