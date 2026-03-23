import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { modlogEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

/**
 * Envoie un embed de log dans le salon configuré pour la modération.
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild} guild
 * @param {Object} opts
 * @param {string} opts.action       Type d'action (BAN, KICK, MUTE, etc.)
 * @param {Object} opts.target       Objet user Discord (id, tag, displayAvatarURL)
 * @param {Object} opts.moderator    Objet user Discord (id, tag)
 * @param {string} opts.reason       Raison de la sanction
 * @param {string} [opts.caseId]     Identifiant du cas
 * @param {Object} [opts.extra]      Champs additionnels { nom: valeur }
 */
export async function logCase(client, guild, { action, target, moderator, reason, caseId, extra }) {
  const config = getGuildConfig(guild.id);
  if (!config.modlogs_channel_id) return;

  const channel = guild.channels.cache.get(config.modlogs_channel_id);
  if (!channel?.isTextBased()) return;

  const embed = modlogEmbed({ action, target, moderator, reason, caseId, extra });

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`[modlogs] Impossible d'envoyer dans ${channel.id} : ${err.message}`);
  }
}
