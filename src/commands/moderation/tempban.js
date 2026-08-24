import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { createTempBan, removeTempBan } from '../../database/repositories/TempBanRepository.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';
import { logger } from '../../utils/logger.js';

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

  // ── Ordre CRITIQUE : INSERT DB AVANT ban Discord ──────────────────────────
  // Si INSERT échoue → on n'a pas banni, l'utilisateur reste sur le serveur,
  // le modo voit une erreur claire. Aucun état incohérent.
  // Si INSERT réussit et ban Discord échoue → on retire l'entrée DB avant de
  // remonter l'erreur, retour à l'état initial.
  try {
    createTempBan({
      guildId: interaction.guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
      expiresAt: expiresAt.getTime(),
    });
  } catch (err) {
    logger.error(`[tempban] INSERT DB échoué pour ${target.id} : ${err.message}. Ban Discord annulé.`);
    return interaction.reply({
      content: '❌ Enregistrement en base impossible — bannissement annulé pour éviter un ban permanent accidentel.',
      ephemeral: true,
    });
  }

  try {
    await guard.member.ban({ reason: `[TempBan ${formatted}] ${reason}` });
  } catch (err) {
    // Rollback compensatoire — on retire le row DB puisque le ban n'a pas eu lieu.
    logger.error(`[tempban] Ban Discord échoué pour ${target.id} : ${err.message}. Rollback DB.`);
    removeTempBan(interaction.guild.id, target.id);
    return interaction.reply({
      content: `❌ Discord a refusé le bannissement : \`${err.message}\`. Aucun changement.`,
      ephemeral: true,
    });
  }

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
