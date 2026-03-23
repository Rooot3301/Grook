import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Bannir un utilisateur définitivement.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à bannir').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du bannissement').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable sur ce serveur.', ephemeral: true });
  if (!member.bannable) return interaction.reply({ content: '❌ Je ne peux pas bannir cet utilisateur (rôle supérieur ou bot).', ephemeral: true });
  if (member.roles.highest.position >= interaction.member.roles.highest.position) {
    return interaction.reply({ content: '❌ Vous ne pouvez pas bannir un membre avec un rôle égal ou supérieur au vôtre.', ephemeral: true });
  }

  await target.send(`🔨 Tu as été **banni** de **${interaction.guild.name}**.\n> Raison : ${reason}`).catch(() => {});

  await member.ban({ reason });
  const caseData = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'BAN', reason, moderatorId: interaction.user.id });

  await logCase(interaction.client, interaction.guild, {
    action: 'BAN',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
  });

  const embed = moderationEmbed({ action: 'BAN', target, moderator: interaction.user, reason, caseId: caseData.case_id });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
