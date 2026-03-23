import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { incrementWin } from '../../database/repositories/StatsRepository.js';

const activeSpies = new Map();

// Paires de mots : [mot commun, mot undercover]
const WORD_PAIRS = [
  ['Pizza', 'Burger'],
  ['Chien', 'Loup'],
  ['Voiture', 'Moto'],
  ['Plage', 'Piscine'],
  ['Café', 'Thé'],
  ['Football', 'Rugby'],
  ['Paris', 'Londres'],
  ['Chocolat', 'Caramel'],
];

export const data = new SlashCommandBuilder()
  .setName('grookspy')
  .setDescription('GrookSpy (Undercover) — trouvez l\'espion parmi vous !');

export async function execute(interaction, client) {
  const channelId = interaction.channel.id;
  if (activeSpies.has(channelId)) {
    return interaction.reply({ content: '❌ Une partie d\'Undercover est déjà en cours ici.', ephemeral: true });
  }

  const pair   = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
  const joinId = `grookspy_join_${Date.now()}`;
  const state  = { players: new Set(), joinId, stage: 'join', timer: null, words: { base: pair[0], undercover: pair[1] }, undercover: null, clues: new Map(), voteIdPrefix: null, votes: new Map() };
  activeSpies.set(channelId, state);

  const row   = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(joinId).setLabel('Rejoindre 🕵️').setStyle(ButtonStyle.Primary));
  const embed = new EmbedBuilder()
    .setTitle('🕵️ GrookSpy — Undercover')
    .setDescription('Appuyez sur **Rejoindre** pour participer.\nLa partie commence dans **30 secondes**.')
    .setColor(0x8844ff);

  await interaction.reply({ embeds: [embed], components: [row] });

  client.interactionHandlers.set(joinId, async btn => {
    const s = activeSpies.get(channelId);
    if (!s || s.stage !== 'join') return btn.reply({ content: '❌ La partie a déjà commencé.', ephemeral: true });
    s.players.add(btn.user.id);
    await btn.reply({ content: '✅ Tu es inscrit à la partie !', ephemeral: true });
  });

  state.timer = setTimeout(() => startSpy(interaction, client, channelId), 30_000);
}

async function startSpy(interaction, client, channelId) {
  const state = activeSpies.get(channelId);
  if (!state) return;
  state.stage = 'clue';
  client.interactionHandlers.delete(state.joinId);

  const players = Array.from(state.players);
  if (players.length < 3) {
    activeSpies.delete(channelId);
    return interaction.followUp({ content: '❌ Pas assez de joueurs (minimum 3). Partie annulée.' });
  }

  state.undercover = players[Math.floor(Math.random() * players.length)];

  for (const id of players) {
    try {
      const word = id === state.undercover ? state.words.undercover : state.words.base;
      const user = await client.users.fetch(id);
      await user.send(`🎯 Ton mot : **${word}**\nDonne un indice en **un mot** dans le salon sans révéler ton mot !`);
    } catch { /* DMs désactivés */ }
  }

  try { await interaction.editReply({ components: [] }); } catch { /* ignore */ }
  await interaction.followUp({ content: `📬 Les mots ont été distribués par DM. Chaque joueur doit maintenant donner un **indice en un mot** dans ce salon.`, allowedMentions: { users: players } });

  const filter    = m => !m.author.bot && state.players.has(m.author.id) && !state.clues.has(m.author.id);
  const collector = interaction.channel.createMessageCollector({ filter, time: 60_000 });
  collector.on('collect', m => {
    state.clues.set(m.author.id, m.content.trim().split(/\s+/)[0]); // un seul mot
    m.react('✅');
    if (state.clues.size === state.players.size) collector.stop('all');
  });
  collector.on('end', async () => launchVote(interaction, client, channelId));
}

async function launchVote(interaction, client, channelId) {
  const state   = activeSpies.get(channelId);
  if (!state) return;
  state.stage   = 'vote';
  const players = Array.from(state.players);

  const embed = new EmbedBuilder().setTitle('🗳️ Vote — Qui est l\'Undercover ?').setColor(0x8844ff);
  for (const id of players) {
    embed.addFields({ name: interaction.guild.members.cache.get(id)?.user.tag ?? id, value: state.clues.get(id) ?? '(aucun indice)' });
  }

  const votePrefix    = `grookspy_vote_${Date.now()}`;
  state.voteIdPrefix  = votePrefix;
  const row = new ActionRowBuilder();
  for (const id of players) {
    row.addComponents(new ButtonBuilder()
      .setCustomId(`${votePrefix}_${id}`)
      .setLabel(interaction.guild.members.cache.get(id)?.user.username ?? id.slice(0, 10))
      .setStyle(ButtonStyle.Secondary));
  }

  await interaction.followUp({ embeds: [embed], components: [row] });

  for (const id of players) {
    client.interactionHandlers.set(`${votePrefix}_${id}`, async btn => {
      const s = activeSpies.get(channelId);
      if (!s || s.stage !== 'vote') return btn.reply({ content: '❌ Vote terminé.', ephemeral: true });
      if (!players.includes(btn.user.id)) return btn.reply({ content: '❌ Tu ne participes pas à cette partie.', ephemeral: true });
      if (s.votes.has(btn.user.id)) return btn.reply({ content: '❌ Tu as déjà voté.', ephemeral: true });
      s.votes.set(btn.user.id, id);
      await btn.reply({ content: `✅ Vote pour <@${id}> enregistré.`, ephemeral: true });
      if (s.votes.size === players.length) await concludeSpy(interaction, client, channelId);
    });
  }

  setTimeout(() => concludeSpy(interaction, client, channelId), 30_000);
}

async function concludeSpy(interaction, client, channelId) {
  const state = activeSpies.get(channelId);
  if (!state || state.stage === 'ended') return;
  state.stage = 'ended';
  activeSpies.delete(channelId);

  const players = Array.from(state.players);
  if (state.voteIdPrefix) for (const id of players) client.interactionHandlers.delete(`${state.voteIdPrefix}_${id}`);

  const tally = {};
  for (const v of state.votes.values()) tally[v] = (tally[v] ?? 0) + 1;

  let votedOut = null, maxVotes = 0;
  for (const id of players) {
    if ((tally[id] ?? 0) > maxVotes) { votedOut = id; maxVotes = tally[id]; }
  }

  let msg;
  if (votedOut === state.undercover) {
    for (const id of players) if (id !== state.undercover) incrementWin(interaction.guild.id, id, 'spy');
    msg = `🔍 L\'Undercover <@${state.undercover}> a été découvert ! Les citoyens gagnent.\n> Mots : **${state.words.base}** (citoyens) / **${state.words.undercover}** (undercover)`;
  } else {
    incrementWin(interaction.guild.id, state.undercover, 'spy');
    msg = `😈 L\'Undercover <@${state.undercover}> a trompé tout le monde et gagne ! (Éliminé : <@${votedOut}>)\n> Mots : **${state.words.base}** / **${state.words.undercover}**`;
  }
  await interaction.followUp({ content: msg, allowedMentions: { users: players } });
}
