import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getEdited } from '../../features/snipe.js';
import { COLORS, errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('editsnipe')
    .setDescription('Affiche la dernière modification de message dans ce salon.'),

  async execute(interaction) {
    const entry = getEdited(interaction.channelId);

    if (!entry) {
      return interaction.reply({ embeds: [errorEmbed('Aucune modification en cache pour ce salon.')], ephemeral: true });
    }

    const ago = Math.floor((Date.now() - entry.timestamp) / 1000);

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setAuthor({ name: entry.author.tag, iconURL: entry.author.avatar })
      .setTitle('✏️ Dernier message modifié')
      .setURL(entry.url)
      .addFields(
        { name: '📝 Avant', value: entry.before },
        { name: '✅ Après', value: entry.after },
      )
      .setFooter({ text: `Modifié il y a ${ago}s` })
      .setTimestamp(entry.timestamp);

    await interaction.reply({ embeds: [embed] });
  },
};
