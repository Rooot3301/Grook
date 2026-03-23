import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Retirer le timeout d\'un utilisateur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à démute').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison (optionnelle)').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });
  if (!member.communicationDisabledUntil) {
    return interaction.reply({ content: `❌ **${target.tag}** n'est pas mute.`, ephemeral: true });
  }

  await member.timeout(null, reason);
  const caseData = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'UNMUTE', reason, moderatorId: interaction.user.id });

  await logCase(interaction.client, interaction.guild, {
    action: 'UNMUTE',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
  });

  const embed = moderationEmbed({ action: 'UNMUTE', target, moderator: interaction.user, reason, caseId: caseData.case_id });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
