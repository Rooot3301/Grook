import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createWarn, getWarnsForUser } from '../../database/repositories/WarnRepository.js';
import { createCase } from '../../database/repositories/CaseRepository.js';
import { logCase } from '../../features/modlogs.js';
import { moderationEmbed } from '../../utils/embeds.js';

// Seuils : [nombre de warns, action automatique]
const THRESHOLDS = [
  { count: 7, action: 'ban',     label: 'Banni automatiquement (7 avertissements)' },
  { count: 5, action: 'kick',    label: 'Expulsé automatiquement (5 avertissements)' },
  { count: 3, action: 'mute_1h', label: 'Mute 1h automatiquement (3 avertissements)' },
];

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Donner un avertissement à un membre.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à avertir').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison de l\'avertissement').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });

  await target.send(`⚠️ Tu as reçu un **avertissement** dans **${interaction.guild.name}**.\n> Raison : ${reason}`).catch(() => {});

  createWarn({ guildId: interaction.guild.id, userId: target.id, reason, moderatorId: interaction.user.id });
  const caseData = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'WARN', reason, moderatorId: interaction.user.id });

  await logCase(interaction.client, interaction.guild, {
    action: 'WARN',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
  });

  const allWarns = getWarnsForUser(interaction.guild.id, target.id);
  const warnCount = allWarns.length;

  const embed = moderationEmbed({
    action: 'WARN',
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
    extra: { '⚠️ Total warns': `${warnCount}` },
  });
  await interaction.reply({ embeds: [embed], ephemeral: true });

  // ─── Seuils automatiques ───────────────────────────────────────────────────
  const threshold = THRESHOLDS.find(t => warnCount === t.count);
  if (!threshold) return;

  const botReason = `${threshold.label} · via /warn`;

  if (threshold.action === 'ban' && member.bannable) {
    await target.send(`🔨 Tu as été **banni** de **${interaction.guild.name}** (seuil automatique : 7 avertissements).`).catch(() => {});
    await member.ban({ reason: botReason });
    const autoCase = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'BAN', reason: botReason, moderatorId: interaction.client.user.id });
    await logCase(interaction.client, interaction.guild, { action: 'BAN', target, moderator: interaction.client.user, reason: botReason, caseId: autoCase.case_id });
    return;
  }

  if (threshold.action === 'kick' && member.kickable) {
    await target.send(`👢 Tu as été **expulsé** de **${interaction.guild.name}** (seuil automatique : 5 avertissements).`).catch(() => {});
    await member.kick(botReason);
    const autoCase = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'KICK', reason: botReason, moderatorId: interaction.client.user.id });
    await logCase(interaction.client, interaction.guild, { action: 'KICK', target, moderator: interaction.client.user, reason: botReason, caseId: autoCase.case_id });
    return;
  }

  if (threshold.action === 'mute_1h' && member.moderatable) {
    const ms = 60 * 60 * 1000; // 1h
    await target.send(`🔇 Tu as été **mute 1h** dans **${interaction.guild.name}** (seuil automatique : 3 avertissements).`).catch(() => {});
    await member.timeout(ms, botReason);
    const expiresAt = new Date(Date.now() + ms);
    const autoCase = createCase({ guildId: interaction.guild.id, userId: target.id, type: 'MUTE', reason: botReason, moderatorId: interaction.client.user.id, expiresAt });
    await logCase(interaction.client, interaction.guild, { action: 'MUTE', target, moderator: interaction.client.user, reason: botReason, caseId: autoCase.case_id, extra: { '⏱️ Durée': '1h' } });
  }
}
