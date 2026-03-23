import { storeEdited } from '../features/snipe.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client) {
    if (oldMessage.partial || newMessage.partial) return;
    if (!oldMessage.guild) return;
    if (oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    // Stockage editsnipe
    storeEdited(oldMessage, newMessage);

    // Log modlogs si configuré
    const cfg = getGuildConfig(oldMessage.guild.id);
    if (!cfg.modlogs_channel_id) return;

    const channel = oldMessage.guild.channels.cache.get(cfg.modlogs_channel_id);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('✏️ Message modifié')
      .setURL(newMessage.url)
      .addFields(
        { name: '👤 Auteur', value: `<@${oldMessage.author.id}> \`${oldMessage.author.tag}\``, inline: true },
        { name: '📌 Salon',  value: `<#${oldMessage.channel.id}>`, inline: true },
        { name: '📝 Avant',  value: oldMessage.content.slice(0, 1024) || '*vide*' },
        { name: '✅ Après',  value: newMessage.content.slice(0, 1024) || '*vide*' },
      )
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.warn(`[messageUpdate] Impossible d'envoyer dans ${channel.id} : ${err.message}`);
    }
  },
};
