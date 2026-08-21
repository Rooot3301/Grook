import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Supprimer des messages dans le salon courant.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(o => o
    .setName('nombre')
    .setDescription('Nombre de messages à supprimer (1-100)')
    .setMinValue(1).setMaxValue(100)
    .setRequired(true))
  .addUserOption(o => o
    .setName('user')
    .setDescription('Ne supprimer que les messages de cet utilisateur'));

export async function execute(interaction) {
  const amount = interaction.options.getInteger('nombre', true);
  const only   = interaction.options.getUser('user');
  await interaction.deferReply({ ephemeral: true });

  try {
    let deletedCount;
    if (only) {
      // Filtrage manuel : fetch puis bulkDelete des matches
      const messages = await interaction.channel.messages.fetch({ limit: Math.min(100, amount * 3) });
      const toDelete = messages.filter(m => m.author.id === only.id).first(amount);
      if (toDelete.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed(`Aucun message récent de ${only.tag} à supprimer.`)] });
      }
      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      deletedCount = deleted.size;
    } else {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      deletedCount = deleted.size;
    }

    if (deletedCount === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Aucun message supprimable (probablement > 14 jours).')] });
    }

    await logChannelAction(interaction.client, interaction.guild, {
      action: 'CLEAR', channel: interaction.channel, moderator: interaction.user,
      reason: only ? `Purge des messages de ${only.tag}` : `Purge de ${deletedCount} messages`,
      extra: { '🧹 Supprimés': `${deletedCount}`, ...(only && { '👤 Cible': `<@${only.id}>` }) },
    });

    await interaction.editReply({ embeds: [successEmbed(`**${deletedCount}** message(s) supprimé(s).`)] });
  } catch (err) {
    if (err.code === 50034) {
      return interaction.editReply({ embeds: [errorEmbed('Impossible de supprimer des messages de plus de 14 jours.')] });
    }
    await interaction.editReply({ embeds: [errorEmbed('Impossible de supprimer les messages.')] });
  }
}
