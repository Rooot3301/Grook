import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Expulser un utilisateur du serveur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à expulser').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison de l\'expulsion').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });
  if (!member.kickable) return interaction.reply({ content: '❌ Je ne peux pas expulser cet utilisateur.', ephemeral: true });
  if (member.roles.highest.position >= interaction.member.roles.highest.position) {
    return interaction.reply({ content: '❌ Rôle égal ou supérieur au vôtre.', ephemeral: true });
  }

  await target.send(`👢 Tu as été **expulsé** de **${interaction.guild.name}**.\n> Raison : ${reason}`).catch(() => {});

  await member.kick(reason);
  const caseData = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'KICK', reason, moderatorId: interaction.user.id });

  await logCase(interaction.client, interaction.guild, {
    action: 'KICK',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
  });

  const embed = moderationEmbed({ action: 'KICK', target, moderator: interaction.user, reason, caseId: caseData.case_id });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
