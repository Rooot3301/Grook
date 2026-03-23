import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { removeTempBan } from '../../database/repositories/TempBanRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Révoquer le bannissement d\'un utilisateur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption(o => o.setName('userid').setDescription('ID de l\'utilisateur à débannir').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison (optionnelle)').setRequired(false));

export async function execute(interaction) {
  const userId = interaction.options.getString('userid', true).trim();
  const reason = interaction.options.getString('reason') || 'Aucune raison';

  // Vérifie que l'utilisateur est bien banni
  const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
  if (!ban) {
    return interaction.reply({ content: `❌ Aucun ban trouvé pour l'ID \`${userId}\`.`, ephemeral: true });
  }

  await interaction.guild.members.unban(userId, reason);
  removeTempBan(interaction.guild.id, userId); // nettoie les temp-bans si applicable

  const target = ban.user;
  const caseData = createCase({ guildId: interaction.guild.id, userId, type: 'UNBAN', reason, moderatorId: interaction.user.id });

  await logCase(interaction.client, interaction.guild, {
    action: 'UNBAN',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
  });

  const embed = moderationEmbed({ action: 'UNBAN', target, moderator: interaction.user, reason, caseId: caseData.case_id });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
