import { getExpiredTempBans, removeTempBan } from '../database/repositories/TempBanRepository.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { modlogEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { bus } from '../http/events.js';

/**
 * Vérifie et applique tous les temp-bans expirés.
 * Appelé au démarrage et toutes les minutes depuis ready.js.
 *
 * @param {import('discord.js').Client} client
 */
export async function processExpiredTempBans(client) {
  const expired = getExpiredTempBans();
  if (!expired.length) return;

  for (const ban of expired) {
    try {
      const guild = client.guilds.cache.get(ban.guild_id);
      if (!guild) {
        // Bot n'est plus sur cette guild — pas d'action possible, on nettoie.
        removeTempBan(ban.guild_id, ban.user_id);
        continue;
      }

      // ── Tentative d'unban Discord ─────────────────────────────────────
      let unbanState;   // 'success' | 'already-unbanned' | 'failed'
      try {
        await guild.members.unban(ban.user_id, 'Temp-ban expiré');
        unbanState = 'success';
        logger.info(`[TempBan] Débanni ${ban.user_id} sur ${guild.name} (expiration)`);
      } catch (err) {
        if (err.code === 10026) {           // Unknown Ban — déjà débanni manuellement
          unbanState = 'already-unbanned';
        } else {
          unbanState = 'failed';
          logger.warn(`[TempBan] Débannissement impossible pour ${ban.user_id} sur ${guild.name} : ${err.message}. On retry au prochain tick.`);
        }
      }

      // Ne nettoie la DB que si l'unban a effectivement pris (ou n'était plus nécessaire).
      // Sinon on laisse la ligne — le worker retentera dans 60s.
      if (unbanState === 'failed') continue;

      removeTempBan(ban.guild_id, ban.user_id);
      bus.publish('tempban:expired', ban.guild_id, {
        userId: ban.user_id,
        moderatorId: ban.moderator_id,
        reason: ban.reason,
      });

      // Log dans le salon modlogs si configuré
      const config = getGuildConfig(ban.guild_id);
      if (!config.modlogs_channel_id) continue;

      const channel = guild.channels.cache.get(config.modlogs_channel_id);
      if (!channel) continue;

      let targetUser;
      try { targetUser = await client.users.fetch(ban.user_id); } catch { continue; }
      let modUser;
      try { modUser = await client.users.fetch(ban.moderator_id); } catch { modUser = { id: ban.moderator_id, tag: ban.moderator_id, displayAvatarURL: () => null }; }

      const embed = modlogEmbed({
        action: 'UNBAN',
        target: targetUser,
        moderator: modUser,
        reason: 'Temp-ban expiré automatiquement',
      });

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`[TempBan] Erreur lors du traitement du ban expiré (${ban.user_id}): ${err.message}`);
    }
  }
}
