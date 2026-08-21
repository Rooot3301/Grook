import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerAuth } from './auth.js';
import { registerWebSocket } from './ws.js';
import { guildRoutes } from './routes/guilds.js';
import { systemRoutes } from './routes/system.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'dashboard', 'dist');

/**
 * Démarre le serveur HTTP (dashboard) dans le même process que le bot.
 * Renvoie l'instance Fastify pour fermeture propre.
 */
export async function startDashboard(client) {
  const port      = Number(process.env.DASHBOARD_PORT || 3000);
  const publicUrl = (process.env.DASHBOARD_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
  const ownerId   = process.env.BOT_OWNER_ID?.trim();

  const fastify = Fastify({
    logger: false,
    trustProxy: true,
    disableRequestLogging: true,
  });

  await registerAuth(fastify, { publicUrl, ownerId });
  await registerWebSocket(fastify);
  await fastify.register(systemRoutes, { client });
  await fastify.register(guildRoutes, { client });

  // Statique du frontend (build Vite dans dashboard/dist/)
  if (fs.existsSync(FRONTEND_DIST)) {
    await fastify.register(fastifyStatic, {
      root: FRONTEND_DIST,
      wildcard: false,
    });
    // Fallback SPA : toute route non-API non-WS renvoie index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/auth/') || request.url === '/ws') {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    logger.warn(`[dashboard] Frontend absent (${FRONTEND_DIST}). L'API est active mais aucune UI n'est servie.`);
    fastify.get('/', async () => ({
      status: 'ok',
      dashboard: 'api-only',
      hint: 'Build le frontend avec : cd dashboard && npm run build',
    }));
  }

  await fastify.listen({ port, host: '0.0.0.0' });
  logger.info(`[dashboard] Écoute sur ${publicUrl} (port ${port})`);
  return fastify;
}
