import { storeDeleted } from '../features/snipe.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'messageDelete',
  async execute(message, client) {
    // Messages partiels (non mis en cache) — on ignore
    if (message.partial || !message.guild) return;
    if (message.author?.bot) return;

    // Stockage snipe
    storeDeleted(message);

    // Log modlogs si configuré
    const cfg = getGuildConfig(message.guild.id);
    if (!cfg.modlogs_channel_id) return;

    const channel = message.guild.channels.cache.get(cfg.modlogs_channel_id);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setTitle('🗑️ Message supprimé')
      .addFields(
        { name: '👤 Auteur',  value: `<@${message.author.id}> \`${message.author.tag}\``, inline: true },
        { name: '📌 Salon',   value: `<#${message.channel.id}>`, inline: true },
      )
      .setTimestamp();

    if (message.content) {
      embed.addFields({ name: '💬 Contenu', value: message.content.slice(0, 1024) });
    }

    if (message.attachments.size) {
      embed.addFields({
        name: '📎 Pièces jointes',
        value: [...message.attachments.values()].map(a => a.proxyURL).join('\n').slice(0, 1024),
      });
    }

    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`[messageDelete] Impossible d'envoyer dans ${channel.id} : ${err.message}`);
    }
  },
};
