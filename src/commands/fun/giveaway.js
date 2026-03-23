import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import {
  createGiveaway,
  setGiveawayMessage,
} from '../../database/repositories/GiveawayRepository.js';
import {
  buildGiveawayEmbed,
  giveawayRow,
  scheduleGiveaway,
  getParticipants,
} from '../../features/giveaways.js';
import { errorEmbed } from '../../utils/embeds.js';

const DURATION_RE = /^(\d+)(s|m|h|d)$/;
const DURATION_MAP = { s: 1, m: 60, h: 3600, d: 86400 };

function parseDuration(str) {
  const m = DURATION_RE.exec(str.trim().toLowerCase());
  if (!m) return null;
  return parseInt(m[1]) * DURATION_MAP[m[2]] * 1000; // ms
}

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Lance un giveaway dans ce salon.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o.setName('lot')
       .setDescription('Lot à gagner')
       .setRequired(true)
       .setMaxLength(100))
    .addStringOption(o =>
      o.setName('durée')
       .setDescription('Durée (ex: 1h, 30m, 2d, 60s)')
       .setRequired(true)),

  async execute(interaction) {
    const prize      = interaction.options.getString('lot');
    const dureStr    = interaction.options.getString('durée');
    const durationMs = parseDuration(dureStr);

    if (!durationMs || durationMs < 10_000 || durationMs > 7 * 24 * 3600 * 1000) {
      return interaction.reply({
        embeds: [errorEmbed('Durée invalide. Exemples valides : `30s`, `10m`, `2h`, `1d` (max 7 jours, min 10s).')],
        ephemeral: true,
      });
    }

    const endsAt   = Date.now() + durationMs;
    const giveaway = createGiveaway({
      guildId:   interaction.guildId,
      channelId: interaction.channelId,
      prize,
      hostId:    interaction.user.id,
      endsAt,
    });

    const embed = buildGiveawayEmbed(giveaway, 0);
    const row   = giveawayRow(giveaway.id);

    await interaction.reply({ embeds: [embed], components: [row] });
    const msg = await interaction.fetchReply();

    setGiveawayMessage(giveaway.id, msg.id);
    const fullGiveaway = { ...giveaway, message_id: msg.id };

    // Planification de la fin
    scheduleGiveaway(interaction.client, fullGiveaway);

    // Handler pour le bouton de participation
    if (!interaction.client.interactionHandlers) interaction.client.interactionHandlers = new Map();

    interaction.client.interactionHandlers.set(`giveaway_join_${giveaway.id}`, async (btn) => {
      const pool = getParticipants(giveaway.id);

      if (pool.has(btn.user.id)) {
        pool.delete(btn.user.id);
        await btn.reply({ content: '❌ Tu t\'es retiré du giveaway.', ephemeral: true });
      } else {
        pool.add(btn.user.id);
        await btn.reply({ content: '✅ Tu participes au giveaway !', ephemeral: true });
      }

      try {
        await btn.message.edit({ embeds: [buildGiveawayEmbed(fullGiveaway, pool.size)] });
      } catch { /* ignoré si message supprimé */ }
    });
  },
};
