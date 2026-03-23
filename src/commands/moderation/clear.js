import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Supprimer des messages dans le salon courant.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(o => o
    .setName('nombre')
    .setDescription('Nombre de messages à supprimer (1-100)')
    .setMinValue(1)
    .setMaxValue(100)
    .setRequired(true));

export async function execute(interaction) {
  const amount = interaction.options.getInteger('nombre', true);
  try {
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `✅ **${deleted.size}** message(s) supprimé(s).`, ephemeral: true });
  } catch (err) {
    if (err.code === 50034) {
      return interaction.reply({ content: '❌ Impossible de supprimer des messages vieux de plus de 14 jours.', ephemeral: true });
    }
    await interaction.reply({ content: '❌ Impossible de supprimer les messages.', ephemeral: true });
  }
}
