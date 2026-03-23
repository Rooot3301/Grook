import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getDeleted } from '../../features/snipe.js';
import { COLORS, errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Affiche le dernier message supprimé dans ce salon.'),

  async execute(interaction) {
    const entry = getDeleted(interaction.channelId);

    if (!entry) {
      return interaction.reply({ embeds: [errorEmbed('Aucun message supprimé en cache pour ce salon.')], ephemeral: true });
    }

    const ago = Math.floor((Date.now() - entry.timestamp) / 1000);

    const embed = new EmbedBuilder()
      .setColor(COLORS.WARNING)
      .setAuthor({ name: entry.author.tag, iconURL: entry.author.avatar })
      .setTitle('🗑️ Dernier message supprimé')
      .setFooter({ text: `Supprimé il y a ${ago}s` })
      .setTimestamp(entry.timestamp);

    if (entry.content) embed.setDescription(entry.content);

    if (entry.attachments.length) {
      embed.addFields({ name: '📎 Pièces jointes', value: entry.attachments.join('\n') });
      if (entry.attachments.length === 1 && /\.(png|jpe?g|gif|webp)$/i.test(entry.attachments[0])) {
        embed.setImage(entry.attachments[0]);
      }
    }

    await interaction.reply({ embeds: [embed] });
  },
};
