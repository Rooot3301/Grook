import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';
import { errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Bannir un utilisateur (présent sur le serveur ou par ID pour un compte externe).')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à bannir').setRequired(false))
  .addStringOption(o => o
    .setName('id')
    .setDescription('ID Discord à bannir même si absent du serveur (raids/comptes supprimés)')
    .setRequired(false))
  .addStringOption(o => o.setName('reason').setDescription('Raison').setRequired(false).setMaxLength(512))
  .addIntegerOption(o => o
    .setName('purge')
    .setDescription('Supprimer les messages des N derniers jours (0-7)')
    .setMinValue(0).setMaxValue(7).setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const rawId  = interaction.options.getString('id')?.trim();
  const reason = interaction.options.getString('reason') || 'Aucune raison';
  const purge  = interaction.options.getInteger('purge') ?? 0;

  if (!target && !rawId) {
    return interaction.reply({
      embeds: [errorEmbed('Fournis soit `user:<@membre>` (présent) soit `id:<snowflake>` (externe).')],
      ephemeral: true,
    });
  }

  // ── Ban par ID (hors-serveur / compte supprimé) ────────────────────────
  if (rawId && !target) {
    if (!/^\d{17,20}$/.test(rawId)) {
      return interaction.reply({ embeds: [errorEmbed('ID Discord invalide (17-20 chiffres).')], ephemeral: true });
    }
    if (rawId === interaction.user.id)            return interaction.reply({ embeds: [errorEmbed('Impossible : action sur toi-même.')], ephemeral: true });
    if (rawId === interaction.client.user.id)    return interaction.reply({ embeds: [errorEmbed('Impossible : action sur moi.')], ephemeral: true });
    if (rawId === interaction.guild.ownerId)      return interaction.reply({ embeds: [errorEmbed('Impossible : action sur le propriétaire du serveur.')], ephemeral: true });

    let targetUser;
    try { targetUser = await interaction.client.users.fetch(rawId); }
    catch { targetUser = { id: rawId, tag: `Utilisateur inconnu (${rawId})` }; }

    try {
      await interaction.guild.members.ban(rawId, { reason, deleteMessageSeconds: purge * 24 * 60 * 60 });
    } catch (err) {
      return interaction.reply({ embeds: [errorEmbed(`Discord a refusé le ban : \`${err.message}\``)], ephemeral: true });
    }

    // notify best-effort seulement si on a pu fetch le user
    if (targetUser.send) {
      notifyTarget(targetUser, interaction.guild.name, `🔨 Tu as été **banni** (préemptif).\n> Raison : ${reason}`);
    }

    const extra = { '🎯 Mode': 'via ID (compte hors-serveur)' };
    if (purge > 0) extra['🧹 Messages purgés'] = `${purge} jour(s)`;

    const { embed } = await finalizeSanction(interaction, { action: 'BAN', target: targetUser, reason, extra });
    return interaction.reply({ embeds: [embed] });
  }

  // ── Ban standard (utilisateur présent sur le serveur) ──────────────────
  const guard = await runSanctionGuards(interaction, target, 'bannable');
  if (!guard.ok) return;

  await guard.member.ban({ reason, deleteMessageSeconds: purge * 24 * 60 * 60 });
  notifyTarget(target, interaction.guild.name, `🔨 Tu as été **banni**.\n> Raison : ${reason}`);

  const extra = purge > 0 ? { '🧹 Messages purgés': `${purge} jour(s)` } : undefined;
  const { embed } = await finalizeSanction(interaction, { action: 'BAN', target, reason, extra });
  await interaction.reply({ embeds: [embed] });
}
