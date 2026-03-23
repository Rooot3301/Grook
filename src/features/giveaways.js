import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  getActiveGiveaways,
  endGiveaway,
  getGiveaway,
} from '../database/repositories/GiveawayRepository.js';
import { COLORS } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

const GIVEAWAY_EMOJI = '🎉';

/**
 * Construit l'embed d'un giveaway en cours.
 */
export function buildGiveawayEmbed(giveaway, participantCount = 0) {
  const endsAt = giveaway.ends_at; // unix seconds
  return new EmbedBuilder()
    .setColor(COLORS.FUN)
    .setTitle(`${GIVEAWAY_EMOJI} GIVEAWAY — ${giveaway.prize}`)
    .setDescription(
      `Cliquez sur **${GIVEAWAY_EMOJI} Participer** pour tenter votre chance !\n\n` +
      `**Fin :** <t:${endsAt}:R> (<t:${endsAt}:f>)\n` +
      `**Organisé par :** <@${giveaway.host_id}>\n` +
      `**Participants :** ${participantCount}`
    )
    .setFooter({ text: `ID ${giveaway.id}` })
    .setTimestamp(endsAt * 1000);
}

/**
 * Construit l'embed d'un giveaway terminé.
 */
export function buildEndedEmbed(giveaway, winner) {
  return new EmbedBuilder()
    .setColor(winner ? COLORS.SUCCESS : COLORS.NEUTRAL)
    .setTitle(`🏆 GIVEAWAY TERMINÉ — ${giveaway.prize}`)
    .setDescription(
      winner
        ? `Félicitations à <@${winner}> qui remporte **${giveaway.prize}** !\nOrganisé par <@${giveaway.host_id}>.`
        : `Aucun participant. Pas de gagnant.\nOrganisé par <@${giveaway.host_id}>.`
    )
    .setFooter({ text: `ID ${giveaway.id}` })
    .setTimestamp();
}

/** Bouton de participation (customId unique par giveaway) */
export function giveawayRow(giveawayId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join_${giveawayId}`)
      .setLabel('Participer')
      .setEmoji(GIVEAWAY_EMOJI)
      .setStyle(ButtonStyle.Primary),
  );
}

/** Map<giveawayId, Set<userId>> — participants en mémoire */
const participants = new Map();

export function getParticipants(giveawayId) {
  if (!participants.has(giveawayId)) participants.set(giveawayId, new Set());
  return participants.get(giveawayId);
}

/**
 * Planifie un giveaway et retourne le timeout handle.
 * @param {import('discord.js').Client} client
 * @param {Object} giveaway  — row DB
 */
export function scheduleGiveaway(client, giveaway) {
  const delay = giveaway.ends_at * 1000 - Date.now();
  if (delay <= 0) {
    // Déjà expiré — on le traite immédiatement
    setImmediate(() => finaliseGiveaway(client, giveaway.id));
    return null;
  }

  const handle = setTimeout(() => finaliseGiveaway(client, giveaway.id), delay);
  handle.unref?.(); // ne pas bloquer l'arrêt du process
  return handle;
}

/**
 * Tire un gagnant, met à jour le message et la DB.
 */
export async function finaliseGiveaway(client, giveawayId) {
  const giveaway = getGiveaway(giveawayId);
  if (!giveaway || giveaway.ended) return;

  const pool = [...(getParticipants(giveawayId))];
  const winner = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;

  endGiveaway(giveawayId, winner);
  participants.delete(giveawayId);

  // Mise à jour du message Discord
  if (!giveaway.message_id || !giveaway.channel_id) return;

  try {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;

    const msg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (!msg) return;

    await msg.edit({
      embeds: [buildEndedEmbed(giveaway, winner)],
      components: [],
    });

    if (winner) {
      await channel.send({
        content: `🎉 Félicitations <@${winner}> ! Tu remportes **${giveaway.prize}** !`,
        allowedMentions: { users: [winner] },
      });
    } else {
      await channel.send({ content: '😔 Personne n\'a participé au giveaway.' });
    }
  } catch (err) {
    logger.warn(`[giveaways] Erreur lors de la finalisation ${giveawayId}: ${err.message}`);
  }
}

/**
 * Recharge et planifie tous les giveaways actifs au démarrage.
 * @param {import('discord.js').Client} client
 */
export function loadActiveGiveaways(client) {
  const active = getActiveGiveaways();
  logger.info(`[giveaways] ${active.length} giveaway(s) actif(s) rechargé(s)`);

  for (const g of active) {
    scheduleGiveaway(client, g);
  }
}
