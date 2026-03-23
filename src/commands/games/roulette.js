import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { incrementWin } from '../../database/repositories/StatsRepository.js';

const activeGames = new Map();

export const data = new SlashCommandBuilder()
  .setName('grookroulette')
  .setDescription('Lancer une partie de roulette russe.');

export async function execute(interaction, client) {
  const channelId = interaction.channel.id;
  if (activeGames.has(channelId)) {
    return interaction.reply({ content: '❌ Une partie est déjà en cours dans ce salon.', ephemeral: true });
  }

  const joinId = `grookroulette_join_${Date.now()}`;
  const state  = { players: new Set(), joinId, started: false, timeout: null };
  activeGames.set(channelId, state);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(joinId).setLabel('Participer 🔫').setStyle(ButtonStyle.Danger)
  );
  const embed = new EmbedBuilder()
    .setTitle('💥 GrookRoulette')
    .setDescription('Cliquez sur **Participer** pour rejoindre.\nLa partie commence dans **20 secondes** !')
    .setColor(0xff0000);

  await interaction.reply({ embeds: [embed], components: [row] });

  client.interactionHandlers.set(joinId, async btn => {
    const s = activeGames.get(channelId);
    if (!s || s.started) return btn.reply({ content: '❌ La partie a déjà commencé.', ephemeral: true });
    s.players.add(btn.user.id);
    await btn.reply({ content: '✅ Tu as rejoint la roulette, bonne chance !', ephemeral: true });
  });

  state.timeout = setTimeout(() => startGame(interaction, client, channelId), 20_000);
}

async function startGame(interaction, client, channelId) {
  const state = activeGames.get(channelId);
  if (!state) return;
  state.started = true;
  client.interactionHandlers.delete(state.joinId);

  const players = Array.from(state.players);
  if (players.length < 2) {
    activeGames.delete(channelId);
    return interaction.followUp({ content: '❌ Pas assez de joueurs (minimum 2). Partie annulée.' });
  }

  try { await interaction.editReply({ components: [] }); } catch { /* ignore */ }
  await interaction.followUp({ content: `🎯 La partie commence avec **${players.length}** joueurs : ${players.map(id => `<@${id}>`).join(', ')}`, allowedMentions: { users: players } });

  let remaining = [...players];
  while (remaining.length > 1) {
    await new Promise(res => setTimeout(res, 2_000));
    const idx = Math.floor(Math.random() * remaining.length);
    const eliminated = remaining.splice(idx, 1)[0];
    await interaction.followUp({ content: `🔫 <@${eliminated}> a tiré… **BOOM 💥** !`, allowedMentions: { users: [eliminated] } });
  }

  const winner = remaining[0];
  incrementWin(interaction.guild.id, winner, 'roulette');
  await interaction.followUp({ content: `🎉 <@${winner}> est le dernier survivant !`, allowedMentions: { users: [winner] } });
  activeGames.delete(channelId);
}
