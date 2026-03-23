import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { createTempBan } from '../../database/repositories/TempBanRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 an max

export const data = new SlashCommandBuilder()
  .setName('tempban')
  .setDescription('Bannir un utilisateur temporairement.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à bannir').setRequired(true))
  .addStringOption(o => o.setName('duration').setDescription('Durée (ex: 1h, 3d, 2w)').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du bannissement').setRequired(false));

export async function execute(interaction) {
  const target      = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration', true);
  const reason      = interaction.options.getString('reason') || 'Aucune raison';
  const ms          = parseDuration(durationStr);

  if (!ms) return interaction.reply({ content: '❌ Durée invalide. Exemples : `1h`, `3d`, `2w`.', ephemeral: true });
  if (ms > MAX_DURATION_MS) return interaction.reply({ content: '❌ Durée maximale : 1 an.', ephemeral: true });

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable sur ce serveur.', ephemeral: true });
  if (!member.bannable) return interaction.reply({ content: '❌ Je ne peux pas bannir cet utilisateur.', ephemeral: true });
  if (member.roles.highest.position >= interaction.member.roles.highest.position) {
    return interaction.reply({ content: '❌ Rôle égal ou supérieur au vôtre.', ephemeral: true });
  }

  const expiresAt = Date.now() + ms;
  const formatted = formatDuration(ms);

  await target.send(`⏳ Tu as été **temp-banni** de **${interaction.guild.name}** pendant **${formatted}**.\n> Raison : ${reason}`).catch(() => {});

  await member.ban({ reason: `[TempBan ${formatted}] ${reason}` });
  createTempBan({ guildId: interaction.guild.id, userId: target.id, moderatorId: interaction.user.id, reason, expiresAt });

  const caseData = createCase({
    guildId: interaction.guild.id,
    userId: target.id,
    type: 'TEMPBAN',
    reason,
    moderatorId: interaction.user.id,
    expiresAt: new Date(expiresAt),
  });

  await logCase(interaction.client, interaction.guild, {
    action: 'TEMPBAN',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
    extra: { '⏱️ Durée': formatted, '⏰ Expire': `<t:${Math.floor(expiresAt / 1000)}:R>` },
  });

  const embed = moderationEmbed({
    action: 'TEMPBAN',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
    extra: { '⏱️ Durée': formatted, '⏰ Expire': `<t:${Math.floor(expiresAt / 1000)}:R>` },
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
