import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Afficher la latence du bot (WebSocket + API).');

export async function execute(interaction) {
  const before = Date.now();
  await interaction.deferReply({ ephemeral: true });
  const apiLatency = Date.now() - before;
  const wsLatency  = interaction.client.ws.ping;

  const wsColor = wsLatency < 100 ? COLORS.SUCCESS : wsLatency < 250 ? COLORS.WARNING : COLORS.ERROR;

  const embed = new EmbedBuilder()
    .setTitle('🏓 Pong !')
    .setColor(wsColor)
    .addFields(
      { name: '🌐 WebSocket',  value: `\`${wsLatency} ms\``,  inline: true },
      { name: '📡 API Round-trip', value: `\`${apiLatency} ms\``, inline: true },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
