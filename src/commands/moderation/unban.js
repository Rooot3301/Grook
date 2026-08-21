import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { removeTempBan } from '../../database/repositories/TempBanRepository.js';
import { finalizeSanction } from '../../utils/sanctions.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Révoquer le bannissement d\'un utilisateur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption(o => o.setName('userid').setDescription('ID Discord de l\'utilisateur').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison (optionnelle)').setRequired(false));

export async function execute(interaction) {
  const userId = interaction.options.getString('userid', true).trim();
  const reason = interaction.options.getString('reason') || 'Aucune raison';

  if (!/^\d{17,20}$/.test(userId)) {
    return interaction.reply({ content: '❌ ID Discord invalide (17-20 chiffres attendus).', ephemeral: true });
  }

  const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
  if (!ban) {
    return interaction.reply({ content: `❌ Aucun ban trouvé pour l'ID \`${userId}\`.`, ephemeral: true });
  }

  await interaction.guild.members.unban(userId, reason);
  removeTempBan(interaction.guild.id, userId);

  const { embed } = await finalizeSanction(interaction, { action: 'UNBAN', target: ban.user, reason });
  await interaction.reply({ embeds: [embed] });
}
