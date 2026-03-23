import { AuditLogEvent } from 'discord.js';
import { logCase } from '../features/modlogs.js';
import { logger } from '../utils/logger.js';

// Actions d'audit qu'on intercepte pour les loguer automatiquement
const WATCHED = {
  [AuditLogEvent.MemberBanAdd]:    'BAN',
  [AuditLogEvent.MemberBanRemove]: 'UNBAN',
  [AuditLogEvent.MemberKick]:      'KICK',
};

export default {
  name: 'guildAuditLogEntryCreate',
  async execute(entry, guild) {
    const action = WATCHED[entry.action];
    if (!action) return;

    // On ignore les actions déjà loguées par nos propres commandes
    // (les commandes du bot passent directement par logCase — on évite le double log
    //  en vérifiant si l'exécuteur est le bot lui-même)
    const client = guild.client;
    if (entry.executorId === client.user.id) return;

    try {
      const executor = await guild.members.fetch(entry.executorId).catch(() => null)
        ?? await client.users.fetch(entry.executorId).catch(() => ({
          id: entry.executorId,
          tag: entry.executorId,
          displayAvatarURL: () => null,
        }));

      const target = entry.target
        ?? await client.users.fetch(entry.targetId).catch(() => ({
          id: entry.targetId,
          tag: entry.targetId,
          displayAvatarURL: () => null,
        }));

      await logCase(client, guild, {
        action,
        target,
        moderator: executor,
        reason: entry.reason || 'Aucune raison (action manuelle)',
      });
    } catch (err) {
      logger.warn(`[auditLog] Impossible de loguer l'action ${action} : ${err.message}`);
    }
  },
};
