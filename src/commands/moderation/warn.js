import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import {
  createWarn, getWarnsForUser,
  removeWarnIfInGuild, clearWarnsForUser,
} from '../../database/repositories/WarnRepository.js';
import { getAutomodConfig } from '../../database/repositories/AutomodRepository.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';
import { formatDuration } from '../../utils/time.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { logChannelAction } from '../../features/modlogs.js';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Gestion des avertissements — add / remove / list / clear.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addSubcommand(s => s
    .setName('add')
    .setDescription('Donner un avertissement à un membre.')
    .addUserOption(o => o.setName('user').setDescription('Utilisateur à avertir').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Raison').setRequired(true).setMaxLength(512)))
  .addSubcommand(s => s
    .setName('remove')
    .setDescription('Retirer un avertissement précis (raison obligatoire pour l\'audit).')
    .addIntegerOption(o => o.setName('id').setDescription('ID du warn').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('reason').setDescription('Motif de la suppression').setRequired(true).setMaxLength(300)))
  .addSubcommand(s => s
    .setName('list')
    .setDescription('Lister les avertissements d\'un membre.')
    .addUserOption(o => o.setName('user').setDescription('Membre').setRequired(true)))
  .addSubcommand(s => s
    .setName('clear')
    .setDescription('Vider tous les warns d\'un membre (raison obligatoire).')
    .addUserOption(o => o.setName('user').setDescription('Membre').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Motif').setRequired(true).setMaxLength(300)));

export async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add')    return warnAdd(interaction, client);
  if (sub === 'remove') return warnRemove(interaction);
  if (sub === 'list')   return warnList(interaction);
  if (sub === 'clear')  return warnClear(interaction);
}

async function warnAdd(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

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

  // ── Escalade automod (config /config automod ou dashboard) ────────────────
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
    return escalate('BAN');
  }
  if (cfg.warn_kick_at && warnCount >= cfg.warn_kick_at && guard.member.kickable) {
    notifyTarget(target, interaction.guild.name, `👢 Automod : expulsion au seuil de ${cfg.warn_kick_at} warns.`);
    await guard.member.kick(`[Automod kick] ${warnCount} warns`);
    return escalate('KICK');
  }
  if (cfg.warn_mute_at && warnCount >= cfg.warn_mute_at && guard.member.moderatable) {
    const durS = Math.max(60, Math.min(28 * 24 * 3600, cfg.warn_mute_duration || 3600));
    const ms   = durS * 1000;
    const expiresAt = new Date(Date.now() + ms);
    notifyTarget(target, interaction.guild.name, `🔇 Automod : mute ${formatDuration(ms)} au seuil de ${cfg.warn_mute_at} warns.`);
    await guard.member.timeout(ms, `[Automod mute] ${warnCount} warns`);
    return escalate('MUTE', {
      '⏱️ Durée': formatDuration(ms),
      '⏰ Expire': `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
    }, expiresAt);
  }
}

async function warnRemove(interaction) {
  const warnId = interaction.options.getInteger('id', true);
  const reason = interaction.options.getString('reason', true);

  const result = removeWarnIfInGuild(warnId, interaction.guild.id);
  if (result === null)             return interaction.reply({ embeds: [errorEmbed(`Aucun warn \`#${warnId}\` trouvé.`)], ephemeral: true });
  if (result.wrongGuild === true)  return interaction.reply({ embeds: [errorEmbed('Ce warn appartient à un autre serveur.')], ephemeral: true });

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'WARN_REMOVED', channel: null, moderator: interaction.user,
    reason,
    extra: {
      '⚠️ Warn ID':  `#${warnId}`,
      '👤 Concerne': `<@${result.user_id}>`,
      '📝 Raison retrait': reason,
    },
  });
  await interaction.reply({
    embeds: [successEmbed(`Warn \`#${warnId}\` de <@${result.user_id}> supprimé — motif : ${reason}`)],
    ephemeral: true,
  });
}

async function warnList(interaction) {
  const target = interaction.options.getUser('user', true);
  const warns  = getWarnsForUser(interaction.guild.id, target.id);
  if (!warns.length) {
    return interaction.reply({ embeds: [successEmbed(`**${target.tag}** n'a aucun avertissement.`)], ephemeral: true });
  }
  await sendPaginated(interaction, warns, (slice, page) => {
    const e = new EmbedBuilder().setTitle(`⚠️ Warns de ${target.tag}`).setColor(COLORS.WARN)
      .setDescription(`**${warns.length}** avertissement(s).`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));
    for (const [i, w] of slice.entries()) {
      e.addFields({
        name:  `#${w.id} — <t:${w.created_at}:D>`,
        value: `${w.reason}\n— <@${w.moderator_id}>`,
      });
    }
    return e;
  }, { perPage: 5, ephemeral: true });
}

async function warnClear(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  const count  = clearWarnsForUser(interaction.guild.id, target.id);

  if (count === 0) {
    return interaction.reply({ embeds: [errorEmbed(`**${target.tag}** n'avait aucun warn.`)], ephemeral: true });
  }

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'WARN_CLEARED', channel: null, moderator: interaction.user,
    reason,
    extra: {
      '👤 Concerne':  `<@${target.id}>`,
      '⚠️ Supprimés': `${count}`,
      '📝 Motif':      reason,
    },
  });
  await interaction.reply({
    embeds: [successEmbed(`**${count}** warn(s) de <@${target.id}> supprimés — motif : ${reason}`)],
    ephemeral: true,
  });
}
