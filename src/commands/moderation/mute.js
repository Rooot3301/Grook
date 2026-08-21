import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';

const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // limite Discord

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mute un utilisateur pendant une durée donnée.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à mute').setRequired(true))
  .addStringOption(o => o.setName('duration').setDescription('Durée (ex: 10m, 2h, 1d)').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du mute').setRequired(false).setMaxLength(512));

export async function execute(interaction) {
  const target      = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration', true);
  const reason      = interaction.options.getString('reason') || 'Aucune raison';
  const ms          = parseDuration(durationStr);

  if (!ms) return interaction.reply({ content: '❌ Durée invalide. Exemples : `10m`, `2h`, `1d`, `1w`.', ephemeral: true });
  if (ms > MAX_TIMEOUT_MS) return interaction.reply({ content: '❌ Durée maximale : 28 jours.', ephemeral: true });

  const guard = await runSanctionGuards(interaction, target, 'moderatable');
  if (!guard.ok) return;

  const expiresAt = new Date(Date.now() + ms);
  const formatted = formatDuration(ms);

  await guard.member.timeout(ms, reason);
  notifyTarget(target, interaction.guild.name,
    `🔇 Tu as été **mute** pendant **${formatted}**.\n> Raison : ${reason}`);

  const extra = {
    '⏱️ Durée':  formatted,
    '⏰ Expire': `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
  };

  const { embed } = await finalizeSanction(interaction, {
    action: 'MUTE', target, reason, extra, expiresAt,
  });
  await interaction.reply({ embeds: [embed] });
}
