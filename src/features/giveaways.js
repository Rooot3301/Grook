import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  getActiveGiveaways,
  endGiveaway,
  getGiveaway,
  addParticipant,
  removeParticipant,
  getParticipantIds,
} from '../database/repositories/GiveawayRepository.js';
import { COLORS } from '../utils/embeds.js';
import { safeSetTimeout } from '../utils/time.js';
import { logger } from '../utils/logger.js';
import { bus } from '../http/events.js';

const GIVEAWAY_EMOJI = '🎉';

export function buildGiveawayEmbed(giveaway, participantCount = 0) {
  const endsAt = giveaway.ends_at;
  return new EmbedBuilder()
    .setColor(COLORS.FUN)
    .setTitle(`${GIVEAWAY_EMOJI} GIVEAWAY — ${giveaway.prize}`)
    .setDescription(
      `Clique sur **${GIVEAWAY_EMOJI} Participer** pour tenter ta chance !\n\n` +
      `**Fin :** <t:${endsAt}:R> (<t:${endsAt}:f>)\n` +
      `**Organisé par :** <@${giveaway.host_id}>\n` +
      `**Participants :** ${participantCount}`
    )
    .setFooter({ text: `ID ${giveaway.id}` })
    .setTimestamp(endsAt * 1000);
}

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

export function giveawayRow(giveawayId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join_${giveawayId}`)
      .setLabel('Participer')
      .setEmoji(GIVEAWAY_EMOJI)
      .setStyle(ButtonStyle.Primary),
  );
}

// Handles de timers actifs — évite le double-schedule d'un même giveaway.
const schedules = new Map(); // giveawayId -> handle { cancel() }

export function scheduleGiveaway(client, giveaway) {
  if (schedules.has(giveaway.id)) return schedules.get(giveaway.id);

  const delay = giveaway.ends_at * 1000 - Date.now();
  // Wrapper qui swallow les erreurs pour ne PAS remonter en unhandledRejection.
  // finaliseGiveaway a son propre try/catch mais on double-guard par sécurité.
  const run = () =>
    Promise.resolve()
      .then(() => finaliseGiveaway(client, giveaway.id))
      .catch(err => logger.warn(`[giveaways] finalisation ${giveaway.id} : ${err.message}`));

  if (delay <= 0) {
    setImmediate(run);
    return null;
  }

  const handle = safeSetTimeout(delay, () => {
    schedules.delete(giveaway.id);
    run();
  });
  schedules.set(giveaway.id, handle);
  return handle;
}

/**
 * Tire un gagnant depuis les participants persistés, met à jour le message + la DB.
 */
export async function finaliseGiveaway(client, giveawayId) {
  const giveaway = getGiveaway(giveawayId);
  if (!giveaway || giveaway.ended) return;

  const pool   = getParticipantIds(giveawayId);
  const winner = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;

  endGiveaway(giveawayId, winner);

  bus.publish('giveaway:ended', giveaway.guild_id, {
    id: giveawayId,
    prize: giveaway.prize,
    winnerId: winner,
    participants: pool.length,
  });

  client.interactionHandlers?.delete(`giveaway_join_${giveawayId}`);

  if (!giveaway.message_id || !giveaway.channel_id) return;

  try {
    const channel = await client.channels.fetch(giveaway.channel_id).catch(() => null);
    if (!channel?.isTextBased()) return;

    const msg = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (!msg) return;

    await msg.edit({ embeds: [buildEndedEmbed(giveaway, winner)], components: [] });

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
 * Handler du bouton "Participer" — utilise la table `giveaway_participants`,
 * donc survit au redémarrage.
 */
export function registerGiveawayButtonHandler(client, giveaway) {
  client.interactionHandlers.set(`giveaway_join_${giveaway.id}`, async (btn) => {
    const current = new Set(getParticipantIds(giveaway.id));
    if (current.has(btn.user.id)) {
      removeParticipant(giveaway.id, btn.user.id);
      current.delete(btn.user.id);
      await btn.reply({ content: '❌ Tu t\'es retiré du giveaway.', ephemeral: true });
    } else {
      addParticipant(giveaway.id, btn.user.id);
      current.add(btn.user.id);
      await btn.reply({ content: '✅ Tu participes au giveaway !', ephemeral: true });
    }
    try { await btn.message.edit({ embeds: [buildGiveawayEmbed(giveaway, current.size)] }); }
    catch { /* message supprimé */ }
  });
}

/**
 * Recharge et planifie tous les giveaways actifs + ré-arme leurs boutons.
 * Appelé une fois dans ready.js.
 */
export function loadActiveGiveaways(client) {
  const active = getActiveGiveaways();
  if (!active.length) return;

  for (const g of active) {
    scheduleGiveaway(client, g);
    registerGiveawayButtonHandler(client, g);
  }
  logger.info(`[giveaways] ${active.length} giveaway(s) rechargé(s) + boutons réarmés.`);
}
