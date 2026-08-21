import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { parseDuration } from '../../utils/time.js';
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

const MIN_MS = 10_000;
const MAX_MS = 7 * 24 * 3600 * 1000;

export const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Lance un giveaway dans ce salon.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o => o
    .setName('lot')
    .setDescription('Lot à gagner')
    .setRequired(true)
    .setMaxLength(100))
  .addStringOption(o => o
    .setName('duration')
    .setDescription('Durée (ex: 30s, 10m, 2h, 1d — max 7j)')
    .setRequired(true));

export async function execute(interaction) {
  const prize = interaction.options.getString('lot', true);
  const raw   = interaction.options.getString('duration', true);
  const ms    = parseDuration(raw);

  if (!ms || ms < MIN_MS || ms > MAX_MS) {
    return interaction.reply({
      embeds: [errorEmbed('Durée invalide. Exemples : `30s`, `10m`, `2h`, `1d` (min 10s, max 7 jours).')],
      ephemeral: true,
    });
  }

  const endsAt   = Date.now() + ms;
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
  scheduleGiveaway(interaction.client, fullGiveaway);

  // Bouton de participation (perdu au redémarrage — feature à persister plus tard)
  interaction.client.interactionHandlers.set(`giveaway_join_${giveaway.id}`, async (btn) => {
    const pool = getParticipants(giveaway.id);
    if (pool.has(btn.user.id)) {
      pool.delete(btn.user.id);
      await btn.reply({ content: '❌ Tu t\'es retiré du giveaway.', ephemeral: true });
    } else {
      pool.add(btn.user.id);
      await btn.reply({ content: '✅ Tu participes au giveaway !', ephemeral: true });
    }
    try { await btn.message.edit({ embeds: [buildGiveawayEmbed(fullGiveaway, pool.size)] }); }
    catch { /* message supprimé */ }
  });
}
