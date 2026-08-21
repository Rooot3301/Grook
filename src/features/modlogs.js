import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { modlogEmbed, COLORS } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { bus } from '../http/events.js';

// ─── ACTIONS SUR UTILISATEUR ─────────────────────────────────────────────────

/**
 * Envoie un embed de log dans le salon configuré + publie sur le bus interne.
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild}  guild
 * @param {Object} opts
 * @param {string} opts.action       Type d'action (BAN, KICK, MUTE, WARN…)
 * @param {Object} opts.target       User Discord (id, tag, displayAvatarURL)
 * @param {Object} opts.moderator    User Discord (id, tag)
 * @param {string} opts.reason
 * @param {string} [opts.caseId]
 * @param {Object} [opts.extra]      Champs additionnels
 */
export async function logCase(client, guild, { action, target, moderator, reason, caseId, extra }) {
  bus.publish('case:created', guild.id, {
    action,
    caseId,
    target:    { id: target?.id, tag: target?.tag },
    moderator: { id: moderator?.id, tag: moderator?.tag },
    reason,
    extra,
  });

  const config = getGuildConfig(guild.id);
  if (!config.modlogs_channel_id) return;

  const channel = guild.channels.cache.get(config.modlogs_channel_id);
  if (!channel?.isTextBased()) return;

  const embed = modlogEmbed({ action, target, moderator, reason, caseId, extra });

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`[modlogs] Envoi impossible dans ${channel.id} : ${err.message}`);
  }
}

// ─── ACTIONS SUR CANAL ───────────────────────────────────────────────────────

/**
 * Log d'une action visant un salon (lock, unlock, slowmode, clear, panic).
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild}  guild
 * @param {Object} opts
 * @param {string} opts.action       LOCK, UNLOCK, SLOWMODE, CLEAR, PANIC…
 * @param {Object} opts.channel      Salon cible ({ id, name })
 * @param {Object} opts.moderator    Modérateur (id, tag)
 * @param {string} [opts.reason]
 * @param {Object} [opts.extra]
 */
export async function logChannelAction(client, guild, { action, channel: targetChannel, moderator, reason, extra = {} }) {
  bus.publish('channel:action', guild.id, {
    action,
    channel:   { id: targetChannel?.id, name: targetChannel?.name },
    moderator: { id: moderator?.id, tag: moderator?.tag },
    reason,
    extra,
  });

  const config = getGuildConfig(guild.id);
  if (!config.modlogs_channel_id) return;

  const modlog = guild.channels.cache.get(config.modlogs_channel_id);
  if (!modlog?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(action === 'PANIC' ? COLORS.ERROR : COLORS.NEUTRAL)
    .setTitle(`⚙️ ${action}`)
    .addFields(
      { name: '📍 Salon',       value: targetChannel ? `<#${targetChannel.id}>` : 'Global',   inline: true },
      { name: '🛡️ Modérateur', value: `<@${moderator.id}>\n\`${moderator.tag}\``,             inline: true },
      { name: '​',          value: '​',                                              inline: true },
      { name: '📝 Détail',      value: reason || '—',                                          inline: false },
    )
    .setTimestamp();

  for (const [name, value] of Object.entries(extra)) {
    embed.addFields({ name, value: String(value), inline: true });
  }

  try {
    await modlog.send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`[modlogs] Envoi impossible dans ${modlog.id} : ${err.message}`);
  }
}
