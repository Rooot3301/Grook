import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { createTempBan } from '../../database/repositories/TempBanRepository.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';

const MAX_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 an max

export const data = new SlashCommandBuilder()
  .setName('tempban')
  .setDescription('Bannir un utilisateur temporairement.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à bannir').setRequired(true))
  .addStringOption(o => o.setName('duration').setDescription('Durée (ex: 1h, 3d, 2w)').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du bannissement').setRequired(false).setMaxLength(512));

export async function execute(interaction) {
  const target      = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration', true);
  const reason      = interaction.options.getString('reason') || 'Aucune raison';
  const ms          = parseDuration(durationStr);

  if (!ms) return interaction.reply({ content: '❌ Durée invalide. Exemples : `1h`, `3d`, `2w`.', ephemeral: true });
  if (ms > MAX_DURATION_MS) return interaction.reply({ content: '❌ Durée maximale : 1 an.', ephemeral: true });

  const guard = await runSanctionGuards(interaction, target, 'bannable');
  if (!guard.ok) return;

  const expiresAt = new Date(Date.now() + ms);
  const formatted = formatDuration(ms);

  await guard.member.ban({ reason: `[TempBan ${formatted}] ${reason}` });
  createTempBan({
    guildId: interaction.guild.id,
    userId: target.id,
    moderatorId: interaction.user.id,
    reason,
    expiresAt: expiresAt.getTime(),
  });
  notifyTarget(target, interaction.guild.name,
    `⏳ Tu as été **temp-banni** pendant **${formatted}**.\n> Raison : ${reason}`);

  const extra = {
    '⏱️ Durée':  formatted,
    '⏰ Expire': `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
  };

  const { embed } = await finalizeSanction(interaction, {
    action: 'TEMPBAN', target, reason, extra, expiresAt,
  });
  await interaction.reply({ embeds: [embed] });
}
