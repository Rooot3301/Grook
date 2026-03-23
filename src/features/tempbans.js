import { getExpiredTempBans, removeTempBan } from '../database/repositories/TempBanRepository.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { modlogEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

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
        removeTempBan(ban.guild_id, ban.user_id);
        continue;
      }

      try {
        await guild.members.unban(ban.user_id, 'Temp-ban expiré');
        logger.info(`[TempBan] Débanni ${ban.user_id} sur ${guild.name} (expiration)`);
      } catch (err) {
        // Déjà débanni manuellement — on nettoie quand même
        if (err.code !== 10026) {
          logger.warn(`[TempBan] Impossible de débannir ${ban.user_id} sur ${guild.name}: ${err.message}`);
        }
      }

      removeTempBan(ban.guild_id, ban.user_id);

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
