import { getGuildConfig, setGuildConfig, resetGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { getAllCases, removeCase, countCases } from '../../database/repositories/CaseRepository.js';
import { getWarnsForGuild, removeWarnIfInGuild, countWarnings } from '../../database/repositories/WarnRepository.js';
import { getTempBansForGuild, removeTempBan } from '../../database/repositories/TempBanRepository.js';
import { getGiveawaysForGuild, getGiveaway } from '../../database/repositories/GiveawayRepository.js';
import { finaliseGiveaway } from '../../features/giveaways.js';
import { getStatsForGuild } from '../../database/repositories/StatsRepository.js';
import { getAutomodConfig, setAutomodConfig, resetAutomodConfig } from '../../database/repositories/AutomodRepository.js';
import { bus } from '../events.js';

/**
 * Sérialise une guild Discord (depuis le cache du client) en payload dashboard.
 */
function serializeGuild(g) {
  return {
    id: g.id,
    name: g.name,
    iconUrl: g.iconURL({ size: 128 }) ?? null,
    memberCount: g.memberCount,
    ownerId: g.ownerId,
  };
}

/**
 * preHandler qui vérifie que la guild demandée existe dans le cache du bot
 * et l'expose sur `request.guild`.
 */
function withGuild(client) {
  return async (request, reply) => {
    const guild = client.guilds.cache.get(request.params.id);
    if (!guild) return reply.code(404).send({ error: 'guild_not_found' });
    request.guild = guild;
  };
}

export async function guildRoutes(fastify, { client }) {
  const auth  = { preHandler: fastify.requireOwner };
  const guard = { preHandler: [fastify.requireOwner, withGuild(client)] };

  // Liste des guilds où le bot est présent
  fastify.get('/api/guilds', auth, async () => {
    return client.guilds.cache.map(serializeGuild);
  });

  // Détails d'une guild
  fastify.get('/api/guilds/:id', guard, async (request) => {
    const g = request.guild;
    return {
      ...serializeGuild(g),
      channels: g.channels.cache
        .filter(c => c.type === 0) // GuildText
        .map(c => ({ id: c.id, name: c.name })),
      roles: g.roles.cache.map(r => ({ id: r.id, name: r.name, color: r.hexColor })),
    };
  });

  // Config du serveur
  fastify.get('/api/guilds/:id/config', guard, async (request) => {
    return getGuildConfig(request.params.id);
  });

  fastify.patch('/api/guilds/:id/config', {
    preHandler: [fastify.requireOwner, withGuild(client)],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          modlogs_channel_id: { type: ['string', 'null'], pattern: '^[0-9]{17,20}$' },
          welcome_channel_id: { type: ['string', 'null'], pattern: '^[0-9]{17,20}$' },
          vt_scanner:         { type: 'integer', enum: [0, 1] },
        },
      },
    },
  }, async (request, reply) => {
    if (!Object.keys(request.body).length) return reply.code(400).send({ error: 'no_valid_fields' });
    setGuildConfig(request.params.id, request.body);
    bus.publish('config:updated', request.params.id, request.body);
    return getGuildConfig(request.params.id);
  });

  fastify.post('/api/guilds/:id/config/reset', guard, async (request) => {
    resetGuildConfig(request.params.id);
    bus.publish('config:reset', request.params.id, {});
    return getGuildConfig(request.params.id);
  });

  // Cases (paginé — accepte ?limit=&offset=)
  fastify.get('/api/guilds/:id/cases', guard, async (request) => {
    const limit  = Math.min(500, Math.max(1, Number(request.query.limit)  || 100));
    const offset = Math.max(0, Number(request.query.offset) || 0);
    return {
      total: countCases(request.params.id),
      limit, offset,
      items: getAllCases(request.params.id, { limit, offset }),
    };
  });

  fastify.delete('/api/guilds/:id/cases/:caseId', guard, async (request, reply) => {
    const removed = removeCase(request.params.id, request.params.caseId);
    if (!removed) return reply.code(404).send({ error: 'case_not_found' });
    bus.publish('case:removed', request.params.id, removed);
    return { ok: true, removed };
  });

  // Warnings (paginé — accepte ?limit=&offset=)
  fastify.get('/api/guilds/:id/warnings', guard, async (request) => {
    const limit  = Math.min(500, Math.max(1, Number(request.query.limit)  || 100));
    const offset = Math.max(0, Number(request.query.offset) || 0);
    return {
      total: countWarnings(request.params.id),
      limit, offset,
      items: getWarnsForGuild(request.params.id, { limit, offset }),
    };
  });

  fastify.delete('/api/guilds/:id/warnings/:warnId', guard, async (request, reply) => {
    const result = removeWarnIfInGuild(Number(request.params.warnId), request.params.id);
    if (result === null)          return reply.code(404).send({ error: 'warn_not_found' });
    if (result.wrongGuild === true) return reply.code(403).send({ error: 'wrong_guild' });
    bus.publish('warn:removed', request.params.id, result);
    return { ok: true, removed: result };
  });

  // Tempbans actifs
  fastify.get('/api/guilds/:id/tempbans', guard, async (request) => {
    return getTempBansForGuild(request.params.id);
  });

  // Unban immédiat via le dashboard (débannit sur Discord puis nettoie la DB)
  fastify.post('/api/guilds/:id/tempbans/:userId/unban', guard, async (request, reply) => {
    const { id: guildId, userId } = request.params;
    const { reason = 'Unban depuis dashboard' } = request.body ?? {};
    try {
      await request.guild.members.unban(userId, reason);
    } catch (err) {
      if (err.code !== 10026 /* Unknown Ban */) {
        return reply.code(502).send({ error: 'discord_unban_failed', message: err.message });
      }
    }
    removeTempBan(guildId, userId);
    bus.publish('tempban:removed', guildId, { userId, by: request.session.userId, reason });
    return { ok: true };
  });

  // Giveaways
  fastify.get('/api/guilds/:id/giveaways', guard, async (request) => {
    return getGiveawaysForGuild(request.params.id);
  });

  fastify.post('/api/guilds/:id/giveaways/:giveawayId/end', guard, async (request, reply) => {
    const gid = Number(request.params.giveawayId);
    const g   = getGiveaway(gid);
    if (!g)                              return reply.code(404).send({ error: 'giveaway_not_found' });
    if (g.guild_id !== request.params.id) return reply.code(403).send({ error: 'wrong_guild' });
    if (g.ended)                         return reply.code(409).send({ error: 'already_ended' });

    // Finalisation complète : tire un gagnant, marque terminé, édite le message
    // Discord, nettoie le bouton, publie sur le bus. Idempotent grâce au flag ended.
    await finaliseGiveaway(client, gid);
    bus.publish('giveaway:force-ended', request.params.id, { id: gid });
    return { ok: true };
  });

  // Stats des jeux
  fastify.get('/api/guilds/:id/stats', guard, async (request) => {
    return getStatsForGuild(request.params.id);
  });

  // ── Automod (escalade sur seuils de warn) ────────────────────────────────
  fastify.get('/api/guilds/:id/automod', guard, async (request) => {
    return getAutomodConfig(request.params.id);
  });

  fastify.patch('/api/guilds/:id/automod', guard, async (request, reply) => {
    const allowed = ['enabled', 'warn_mute_at', 'warn_mute_duration', 'warn_kick_at', 'warn_ban_at'];
    const updates = {};
    for (const k of allowed) {
      if (!(k in request.body)) continue;
      const v = request.body[k];
      if (v === null || v === undefined || v === '') { updates[k] = null; continue; }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 100_000) {
        return reply.code(400).send({ error: `invalid_${k}` });
      }
      updates[k] = n;
    }
    if (!Object.keys(updates).length) return reply.code(400).send({ error: 'no_valid_fields' });

    const next = setAutomodConfig(request.params.id, updates);
    bus.publish('automod:updated', request.params.id, next);
    return next;
  });

  fastify.post('/api/guilds/:id/automod/reset', guard, async (request) => {
    const next = resetAutomodConfig(request.params.id);
    bus.publish('automod:reset', request.params.id, {});
    return next;
  });
}
