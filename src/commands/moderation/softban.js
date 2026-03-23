import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('softban')
  .setDescription('Ban + unban immédiat pour purger les messages d\'un membre (7 jours).')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à softban').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du softban').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable sur ce serveur.', ephemeral: true });
  if (!member.bannable) return interaction.reply({ content: '❌ Je ne peux pas bannir cet utilisateur.', ephemeral: true });
  if (member.roles.highest.position >= interaction.member.roles.highest.position) {
    return interaction.reply({ content: '❌ Rôle égal ou supérieur au vôtre.', ephemeral: true });
  }

  await target.send(`🧹 Tu as été **softban** de **${interaction.guild.name}** (messages supprimés).\n> Raison : ${reason}`).catch(() => {});

  // Ban 7 jours de messages puis unban immédiat
  await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: 7 * 24 * 60 * 60 });
  await interaction.guild.members.unban(target.id, 'Softban — unban automatique');

  const caseData = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'SOFTBAN', reason, moderatorId: interaction.user.id });

  await logCase(interaction.client, interaction.guild, {
    action: 'SOFTBAN',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
  });

  const embed = moderationEmbed({ action: 'SOFTBAN', target, moderator: interaction.user, reason, caseId: caseData.case_id });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
