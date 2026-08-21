import { createCase } from '../database/repositories/CaseRepository.js';
import { logCase } from '../features/modlogs.js';
import { moderationEmbed } from './embeds.js';

/**
 * Gardes partagées pour les commandes de sanction (ban/kick/mute/warn/tempban/softban/unmute).
 *
 * Centralise :
 *  - impossibilité de sanctionner soi-même
 *  - impossibilité de sanctionner un bot (le bot lui-même ou un autre bot)
 *  - fetch du membre + gestion d'introuvable
 *  - vérification de faisabilité côté bot (bannable/kickable/moderatable) si `capability` fourni
 *  - hiérarchie de rôles modérateur/cible
 *
 * Répond directement à l'interaction en ephemeral en cas d'échec.
 * @returns {Promise<{ ok: true, member } | { ok: false }>}
 */
export async function runSanctionGuards(interaction, target, capability) {
  if (target.id === interaction.user.id) {
    await interaction.reply({ content: '❌ Impossible : action sur toi-même.', ephemeral: true });
    return { ok: false };
  }
  if (target.id === interaction.client.user.id) {
    await interaction.reply({ content: '❌ Je ne peux pas m\'appliquer une sanction à moi-même.', ephemeral: true });
    return { ok: false };
  }
  if (target.bot) {
    await interaction.reply({ content: '❌ Impossible de sanctionner un bot.', ephemeral: true });
    return { ok: false };
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: '❌ Utilisateur introuvable sur ce serveur.', ephemeral: true });
    return { ok: false };
  }

  if (capability && !member[capability]) {
    await interaction.reply({
      content: '❌ Impossible sur cet utilisateur (rôle égal ou supérieur au mien).',
      ephemeral: true,
    });
    return { ok: false };
  }

  if (member.roles.highest.position >= interaction.member.roles.highest.position) {
    await interaction.reply({
      content: '❌ Cet utilisateur a un rôle égal ou supérieur au tien.',
      ephemeral: true,
    });
    return { ok: false };
  }

  return { ok: true, member };
}

/**
 * Envoie un DM à l'utilisateur — silencieux si le DM échoue (DM fermés, bloqué…).
 * À appeler APRÈS que la sanction a été appliquée avec succès, pour ne pas prévenir
 * la cible d'une action qui n'aurait pas eu lieu.
 */
export async function notifyTarget(target, guildName, message) {
  return target.send(`${message}\n> Serveur : **${guildName}**`).catch(() => null);
}

/**
 * Consigne un cas + envoie dans le modlog + renvoie l'embed pour la réponse dans le salon.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ action, target, reason, extra?, expiresAt? }} opts
 * @returns {Promise<{ caseData, embed }>}
 */
export async function finalizeSanction(interaction, { action, target, reason, extra, expiresAt }) {
  const caseData = createCase({
    guildId: interaction.guild.id,
    userId:  target.id,
    type:    action,
    reason,
    moderatorId: interaction.user.id,
    expiresAt,
  });

  await logCase(interaction.client, interaction.guild, {
    action,
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
    extra,
  });

  const embed = moderationEmbed({
    action,
    target,
    moderator: interaction.user,
    reason,
    caseId: caseData.case_id,
    extra,
  });

  return { caseData, embed };
}
