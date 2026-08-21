import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createWarn, getWarnsForUser } from '../../database/repositories/WarnRepository.js';
import { getAutomodConfig } from '../../database/repositories/AutomodRepository.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';
import { formatDuration } from '../../utils/time.js';

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

  // ── Escalade automatique — DÉSACTIVÉE par défaut, se configure via /config ──
  const cfg = getAutomodConfig(interaction.guild.id);
  if (!cfg.enabled) return;

  const bot     = interaction.client.user;
  const fakeCtx = { client: interaction.client, guild: interaction.guild, user: bot };
  const escalate = (action, extra, expiresAt) => finalizeSanction(fakeCtx, {
    action, target, reason: `[Automod] Seuil ${action} atteint (${warnCount} warns)`, extra, expiresAt,
  });

  if (cfg.warn_ban_at && warnCount >= cfg.warn_ban_at && guard.member.bannable) {
    notifyTarget(target, interaction.guild.name, `🔨 Automod : ban au seuil de ${cfg.warn_ban_at} warns.`);
    await guard.member.ban({ reason: `[Automod ban] ${warnCount} warns` });
    await escalate('BAN');
    return;
  }
  if (cfg.warn_kick_at && warnCount >= cfg.warn_kick_at && guard.member.kickable) {
    notifyTarget(target, interaction.guild.name, `👢 Automod : expulsion au seuil de ${cfg.warn_kick_at} warns.`);
    await guard.member.kick(`[Automod kick] ${warnCount} warns`);
    await escalate('KICK');
    return;
  }
  if (cfg.warn_mute_at && warnCount >= cfg.warn_mute_at && guard.member.moderatable) {
    const durS = Math.max(60, Math.min(28 * 24 * 3600, cfg.warn_mute_duration || 3600));
    const ms   = durS * 1000;
    const expiresAt = new Date(Date.now() + ms);
    notifyTarget(target, interaction.guild.name, `🔇 Automod : mute ${formatDuration(ms)} au seuil de ${cfg.warn_mute_at} warns.`);
    await guard.member.timeout(ms, `[Automod mute] ${warnCount} warns`);
    await escalate('MUTE', {
      '⏱️ Durée': formatDuration(ms),
      '⏰ Expire': `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
    }, expiresAt);
  }
}
