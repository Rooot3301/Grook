import { getGuildConfig, setGuildConfig, resetGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { getAllCases, removeCase } from '../../database/repositories/CaseRepository.js';
import { getWarnsForGuild, removeWarn } from '../../database/repositories/WarnRepository.js';
import { getTempBansForGuild, removeTempBan } from '../../database/repositories/TempBanRepository.js';
import { getGiveawaysForGuild, endGiveaway } from '../../database/repositories/GiveawayRepository.js';
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

  fastify.patch('/api/guilds/:id/config', guard, async (request, reply) => {
    const allowed = ['modlogs_channel_id', 'welcome_channel_id', 'vt_scanner'];
    const updates = {};
    for (const k of allowed) {
      if (k in request.body) updates[k] = request.body[k];
    }
    if (!Object.keys(updates).length) return reply.code(400).send({ error: 'no_valid_fields' });
    setGuildConfig(request.params.id, updates);
    bus.publish('config:updated', request.params.id, updates);
    return getGuildConfig(request.params.id);
  });

  fastify.post('/api/guilds/:id/config/reset', guard, async (request) => {
    resetGuildConfig(request.params.id);
    bus.publish('config:reset', request.params.id, {});
    return getGuildConfig(request.params.id);
  });

  // Cases (casier de sanctions)
  fastify.get('/api/guilds/:id/cases', guard, async (request) => {
    return getAllCases(request.params.id);
  });

  fastify.delete('/api/guilds/:id/cases/:caseId', guard, async (request, reply) => {
    const removed = removeCase(request.params.id, request.params.caseId);
    if (!removed) return reply.code(404).send({ error: 'case_not_found' });
    bus.publish('case:removed', request.params.id, removed);
    return { ok: true, removed };
  });

  // Warnings
  fastify.get('/api/guilds/:id/warnings', guard, async (request) => {
    return getWarnsForGuild(request.params.id);
  });

  fastify.delete('/api/guilds/:id/warnings/:warnId', guard, async (request, reply) => {
    const removed = removeWarn(Number(request.params.warnId));
    if (!removed) return reply.code(404).send({ error: 'warn_not_found' });
    if (removed.guild_id !== request.params.id) {
      return reply.code(403).send({ error: 'wrong_guild' });
    }
    bus.publish('warn:removed', request.params.id, removed);
    return { ok: true, removed };
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

  fastify.post('/api/guilds/:id/giveaways/:giveawayId/end', guard, async (request) => {
    endGiveaway(Number(request.params.giveawayId));
    bus.publish('giveaway:force-ended', request.params.id, { id: Number(request.params.giveawayId) });
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
