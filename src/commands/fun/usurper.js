import { SlashCommandBuilder, PermissionFlagsBits, WebhookClient } from 'discord.js';
import { logChannelAction } from '../../features/modlogs.js';
import { errorEmbed } from '../../utils/embeds.js';

/**
 * /usurper — envoie un message en usurpant le nom + avatar d'un membre.
 *
 * Technique : webhook Discord jetable. Discord ne permet pas de modifier
 * l'avatar d'un autre utilisateur via bot — le webhook est le seul moyen
 * de faire apparaître un message avec le nom + avatar de quelqu'un d'autre.
 *
 * Garde-fous : ManageMessages requis, log complet dans modlogs, refuse
 * bot / owner / soi-même, refuse aussi les cibles qui sont admin/staff
 * pour éviter les usurpations d'autorité.
 */
export const data = new SlashCommandBuilder()
  .setName('usurper')
  .setDescription('Envoyer un message en usurpant l\'identité (nom + avatar) d\'un membre.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addUserOption(o => o.setName('user').setDescription('Membre à usurper').setRequired(true))
  .addStringOption(o => o
    .setName('message')
    .setDescription('Contenu du message à envoyer en son nom')
    .setRequired(true)
    .setMaxLength(1500));

export async function execute(interaction) {
  const target  = interaction.options.getUser('user', true);
  const content = interaction.options.getString('message', true);

  // ── Garde-fous ────────────────────────────────────────────────────────────
  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed('Tu peux te parler toi-même sans usurper personne.')], ephemeral: true });
  }
  if (target.bot) {
    return interaction.reply({ embeds: [errorEmbed('Impossible d\'usurper un bot.')], ephemeral: true });
  }
  if (target.id === interaction.guild.ownerId) {
    return interaction.reply({ embeds: [errorEmbed('Le propriétaire du serveur est intouchable.')], ephemeral: true });
  }

  const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (targetMember?.permissions.has(PermissionFlagsBits.Administrator) &&
      !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      embeds: [errorEmbed('Tu ne peux pas usurper un administrateur sans être admin toi-même.')],
      ephemeral: true,
    });
  }

  // ── Perm webhook côté bot dans ce salon ───────────────────────────────────
  const botPerms = interaction.channel.permissionsFor(interaction.guild.members.me);
  if (!botPerms?.has(PermissionFlagsBits.ManageWebhooks)) {
    return interaction.reply({
      embeds: [errorEmbed('Il me manque la permission **Gérer les webhooks** dans ce salon.')],
      ephemeral: true,
    });
  }

  // ── Nom + avatar de la cible ──────────────────────────────────────────────
  const displayName = targetMember?.displayName ?? target.username;
  const avatarURL   = (targetMember?.displayAvatarURL({ size: 256, extension: 'png' }))
                   ?? target.displayAvatarURL({ size: 256, extension: 'png' });

  await interaction.deferReply({ ephemeral: true });

  // ── Création + envoi + suppression du webhook ─────────────────────────────
  let webhook;
  try {
    webhook = await interaction.channel.createWebhook({
      name:   'Grook Usurper',
      reason: `Usurpation par ${interaction.user.tag} → ${target.tag}`,
    });
  } catch (err) {
    return interaction.editReply({
      embeds: [errorEmbed(`Création du webhook impossible : \`${err.message}\``)],
    });
  }

  const client = new WebhookClient({ id: webhook.id, token: webhook.token });
  try {
    await client.send({
      content:     content,
      username:    displayName.slice(0, 80),
      avatarURL,
      allowedMentions: { parse: [] }, // pas de spam mentions via l'usurpation
    });
  } catch (err) {
    await webhook.delete('Usurpation — envoi échoué').catch(() => null);
    return interaction.editReply({
      embeds: [errorEmbed(`Envoi impossible : \`${err.message}\``)],
    });
  }

  // Nettoyage : webhook supprimé immédiatement pour ne pas rester listé.
  await webhook.delete('Usurpation — nettoyage').catch(() => null);
  client.destroy?.();

  // ── Log complet dans modlogs (traçabilité) ────────────────────────────────
  await logChannelAction(interaction.client, interaction.guild, {
    action: 'USURPER',
    channel: interaction.channel,
    moderator: interaction.user,
    reason: `Usurpation de ${target.tag}`,
    extra: {
      '🎭 Cible':       `<@${target.id}> (\`${target.tag}\`)`,
      '💬 Contenu':      content.length > 200 ? content.slice(0, 197) + '…' : content,
      '📍 Salon':        `<#${interaction.channel.id}>`,
    },
  });

  await interaction.editReply({
    content: `✅ Message envoyé en usurpant **${displayName}**. Trace dans les modlogs.`,
  });
}
