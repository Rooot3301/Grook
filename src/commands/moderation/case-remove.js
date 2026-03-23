import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { removeCase } from '../../database/repositories/CaseRepository.js';

export const data = new SlashCommandBuilder()
  .setName('case-remove')
  .setDescription('Supprimer un cas disciplinaire.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o
    .setName('id')
    .setDescription('ID du cas (ex : GRC-20250101-00001)')
    .setRequired(true));

export async function execute(interaction) {
  const caseId  = interaction.options.getString('id', true).toUpperCase().trim();
  const removed = removeCase(interaction.guild.id, caseId);

  if (!removed) {
    return interaction.reply({ content: `❌ Aucun cas \`${caseId}\` trouvé sur ce serveur.`, ephemeral: true });
  }
  await interaction.reply({ content: `✅ Cas \`${caseId}\` (${removed.type}) supprimé.`, ephemeral: true });
}
