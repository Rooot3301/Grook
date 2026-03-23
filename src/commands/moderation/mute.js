import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 jours (limite Discord)

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mute un utilisateur pendant une durée donnée.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à mute').setRequired(true))
  .addStringOption(o => o.setName('duration').setDescription('Durée (ex: 10m, 2h, 1d)').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du mute').setRequired(false));

export async function execute(interaction) {
  const target      = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration', true);
  const reason      = interaction.options.getString('reason') || 'Aucune raison';
  const ms          = parseDuration(durationStr);

  if (!ms) return interaction.reply({ content: '❌ Durée invalide. Exemples : `10m`, `2h`, `1d`, `1w`.', ephemeral: true });
  if (ms > MAX_TIMEOUT_MS) return interaction.reply({ content: '❌ Durée maximale : 28 jours.', ephemeral: true });

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });
  if (!member.moderatable) return interaction.reply({ content: '❌ Je ne peux pas mute cet utilisateur.', ephemeral: true });

  await target.send(`🔇 Tu as été **mute** dans **${interaction.guild.name}** pendant **${durationStr}**.\n> Raison : ${reason}`).catch(() => {});

  const expiresAt = new Date(Date.now() + ms);
  await member.timeout(ms, reason);
  const caseData = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'MUTE', reason, moderatorId: interaction.user.id, expiresAt });

  const formatted = formatDuration(ms);
  await logCase(interaction.client, interaction.guild, {
    action: 'MUTE',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
    extra: { '⏱️ Durée': formatted, '⏰ Expire': `<t:${Math.floor(expiresAt / 1000)}:R>` },
  });

  const embed = moderationEmbed({
    action: 'MUTE',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
    extra: { '⏱️ Durée': formatted, '⏰ Expire': `<t:${Math.floor(expiresAt / 1000)}:R>` },
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
