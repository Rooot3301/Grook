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
 */
export async function registerWebSocket(fastify) {
  await fastify.register(fastifyWebsocket);

  fastify.get('/ws', {
    websocket: true,
    preHandler: fastify.requireOwner,
  }, (connection) => {
    const socket = connection.socket;
    const listener = (evt) => {
      if (socket.readyState !== socket.OPEN) return;
      try { socket.send(JSON.stringify(evt)); }
      catch (err) { logger.warn('[ws] send échoué :', err.message); }
    };
    bus.on('event', listener);

    socket.send(JSON.stringify({ type: 'hello', ts: Math.floor(Date.now() / 1000) }));

    socket.on('close', () => bus.off('event', listener));
    socket.on('error', () => bus.off('event', listener));
  });
}
