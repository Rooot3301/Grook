import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createWarn, getWarnsForUser } from '../../database/repositories/WarnRepository.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';

// Seuils : à chaque palier atteint, escalade automatique
const THRESHOLDS = [
  { count: 7, action: 'BAN',  label: 'Banni automatiquement (7 avertissements)' },
  { count: 5, action: 'KICK', label: 'Expulsé automatiquement (5 avertissements)' },
  { count: 3, action: 'MUTE', label: 'Mute 1h automatiquement (3 avertissements)', muteMs: 60 * 60 * 1000 },
];

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Donner un avertissement à un membre.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à avertir').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison de l\'avertissement').setRequired(false).setMaxLength(512));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';

  const guard = await runSanctionGuards(interaction, target, 'kickable');
  if (!guard.ok) return;

  createWarn({ guildId: interaction.guild.id, userId: target.id, reason, moderatorId: interaction.user.id });
  notifyTarget(target, interaction.guild.name, `⚠️ Tu as reçu un **avertissement**.\n> Raison : ${reason}`);

  const warnCount = getWarnsForUser(interaction.guild.id, target.id).length;

  const { embed } = await finalizeSanction(interaction, {
    action: 'WARN', target, reason,
    extra: { '⚠️ Total warns': `${warnCount}` },
  });
  await interaction.reply({ embeds: [embed] });

  // ── Escalade automatique ─────────────────────────────────────────────────
  const threshold = THRESHOLDS.find(t => warnCount === t.count);
  if (!threshold) return;

  const botReason = `${threshold.label} · via /warn`;
  const bot       = interaction.client.user;

  // Escalade → fake une "interaction" minimaliste pour finalizeSanction (client = bot)
  const escalate = async (action, extra, expiresAt) => finalizeSanction(
    { client: interaction.client, guild: interaction.guild, user: bot },
    { action, target, reason: botReason, extra, expiresAt },
  );

  if (threshold.action === 'BAN' && guard.member.bannable) {
    notifyTarget(target, interaction.guild.name, `🔨 Tu as été **banni** (seuil automatique : 7 avertissements).`);
    await guard.member.ban({ reason: botReason });
    await escalate('BAN');
    return;
  }
  if (threshold.action === 'KICK' && guard.member.kickable) {
    notifyTarget(target, interaction.guild.name, `👢 Tu as été **expulsé** (seuil automatique : 5 avertissements).`);
    await guard.member.kick(botReason);
    await escalate('KICK');
    return;
  }
  if (threshold.action === 'MUTE' && guard.member.moderatable) {
    notifyTarget(target, interaction.guild.name, `🔇 Tu as été **mute 1h** (seuil automatique : 3 avertissements).`);
    await guard.member.timeout(threshold.muteMs, botReason);
    const expiresAt = new Date(Date.now() + threshold.muteMs);
    await escalate('MUTE', { '⏱️ Durée': '1h', '⏰ Expire': `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` }, expiresAt);
  }
}
