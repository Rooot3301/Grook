import db from '../../database/index.js';
import { getRecentLogs } from '../../utils/logger.js';
import { syncCommands, inventoryCommands, nukeCommands } from '../../loaders/commands.js';
import { VERSION, BUILD_DATE } from '../../version.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Endpoints "système" du dashboard :
 *   GET /api/health       — non-authentifié, health-check machine
 *   GET /api/system/info  — authentifié, infos runtime détaillées
 *   GET /api/system/logs  — authentifié, N derniers logs du ring buffer
 */
export async function systemRoutes(fastify, { client }) {
  // ── Healthcheck (public — utilisé par grook.sh et monitoring externe) ───
  fastify.get('/api/health', async (_request, reply) => {
    const checks = {
      discord:  client.ws?.status === 0,          // 0 = READY
      database: false,
      uptime:   Math.floor(process.uptime()),
    };
    try { db.prepare('SELECT 1').get(); checks.database = true; } catch { /* ignore */ }

    const healthy = checks.discord && checks.database;
    reply.code(healthy ? 200 : 503);
    return { status: healthy ? 'ok' : 'degraded', version: VERSION, checks };
  });

  // ── Infos runtime — protégé ─────────────────────────────────────────────
  fastify.get('/api/system/info', { preHandler: fastify.requireOwner }, async () => {
    const mem = process.memoryUsage();
    let dbSize = null;
    try { dbSize = fs.statSync(path.resolve('data', 'grook.db')).size; } catch { /* ignore */ }

    return {
      version:   VERSION,
      buildDate: BUILD_DATE,
      node:      process.version,
      pid:       process.pid,
      uptimeS:   Math.floor(process.uptime()),
      guilds:    client.guilds.cache.size,
      users:     client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0),
      commands:  client.commands?.size ?? 0,
      wsPing:    client.ws.ping,
      wsStatus:  client.ws?.status ?? -1,
      memory:    {
        heapUsed:  mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss:       mem.rss,
      },
      dbSize,
    };
  });

  // ── Ring buffer des logs — protégé ──────────────────────────────────────
  fastify.get('/api/system/logs', { preHandler: fastify.requireOwner }, async (request) => {
    const limit    = Math.min(500, Math.max(1, Number(request.query.limit) || 100));
    const minLevel = ['debug','info','warn','error'].includes(request.query.level)
      ? request.query.level : 'debug';
    return { logs: getRecentLogs(limit, minLevel) };
  });

  // ── Force-sync des slash commands (utile pour vider les résidus) ────────
  // ?nuke=1 → wipe TOUT (global + toutes guilds) AVANT de republier.
  fastify.post('/api/system/sync-commands', { preHandler: fastify.requireOwner }, async (request) => {
    const nuke = request.query.nuke === '1' || request.query.nuke === 'true';
    return await syncCommands(client, null, { nuke });
  });

  // ── Inventaire des commandes actuellement enregistrées côté Discord ─────
  fastify.get('/api/system/commands', { preHandler: fastify.requireOwner }, async () => {
    return await inventoryCommands(client);
  });

  // ── Wipe SANS republier (nettoyage explicite) ───────────────────────────
  fastify.post('/api/system/commands/wipe', { preHandler: fastify.requireOwner }, async () => {
    return { wiped: await nukeCommands(client) };
  });
}
