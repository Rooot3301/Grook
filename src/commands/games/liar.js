import {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { incrementWin } from '../../database/repositories/StatsRepository.js';

const activeLiars = new Map();

export const data = new SlashCommandBuilder()
  .setName('liar')
  .setDescription('Deux vérités, un mensonge — les autres doivent trouver le mensonge.');

export async function execute(interaction, client) {
  const channelId = interaction.channel.id;
  if (activeLiars.has(channelId)) {
    return interaction.reply({ content: '❌ Une partie est déjà en cours dans ce salon.', ephemeral: true });
  }

  const modalId = `liar_modal_${Date.now()}`;
  const state   = { hostId: interaction.user.id, statements: [], lieIndex: null, votePrefix: null, votes: new Map(), messageId: null };
  activeLiars.set(channelId, state);

  const modal = new ModalBuilder().setCustomId(modalId).setTitle('Deux vérités, un mensonge');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s1').setLabel('Affirmation 1').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s2').setLabel('Affirmation 2').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('s3').setLabel('Affirmation 3').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('lieIdx').setLabel('Numéro du mensonge (1, 2 ou 3)').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1)),
  );

  client.interactionHandlers.set(modalId, async submit => {
    if (submit.user.id !== state.hostId) return submit.reply({ content: '❌ Seul l\'organisateur peut soumettre.', ephemeral: true });
    const s1  = submit.fields.getTextInputValue('s1').trim();
    const s2  = submit.fields.getTextInputValue('s2').trim();
    const s3  = submit.fields.getTextInputValue('s3').trim();
    let   idx = parseInt(submit.fields.getTextInputValue('lieIdx').trim(), 10);
    if (isNaN(idx) || idx < 1 || idx > 3) idx = Math.floor(Math.random() * 3) + 1;

    state.statements = [s1, s2, s3];
    state.lieIndex   = idx - 1;
    client.interactionHandlers.delete(modalId);

    const LABELS = ['A', 'B', 'C'];
    const embed  = new EmbedBuilder()
      .setTitle('🎭 Deux vérités, un mensonge')
      .setDescription('Votez pour l\'affirmation que vous pensez **fausse**.')
      .setColor(0x00bfae);
    for (let i = 0; i < 3; i++) embed.addFields({ name: `${LABELS[i]} — ${state.statements[i]}`, value: '\u200B' });

    const votePrefix = `liar_vote_${Date.now()}`;
    state.votePrefix = votePrefix;
    const row = new ActionRowBuilder();
    for (let i = 0; i < 3; i++) {
      row.addComponents(new ButtonBuilder().setCustomId(`${votePrefix}_${i}`).setLabel(LABELS[i]).setStyle(ButtonStyle.Secondary));
    }

    const sent = await submit.reply({ embeds: [embed], components: [row], fetchReply: true });
    state.messageId = sent.id;

    for (let i = 0; i < 3; i++) {
      client.interactionHandlers.set(`${votePrefix}_${i}`, async btn => {
        const s = activeLiars.get(channelId);
        if (!s) return btn.reply({ content: '❌ Partie terminée.', ephemeral: true });
        if (btn.user.id === s.hostId) return btn.reply({ content: '❌ L\'organisateur ne vote pas.', ephemeral: true });
        if (s.votes.has(btn.user.id)) return btn.reply({ content: '❌ Tu as déjà voté.', ephemeral: true });
        s.votes.set(btn.user.id, i);
        await btn.reply({ content: `✅ Vote pour **${LABELS[i]}** enregistré.`, ephemeral: true });
      });
    }

    setTimeout(() => concludeLiar(submit, client, channelId), 45_000);
  });

  await interaction.showModal(modal);
}

async function concludeLiar(interaction, client, channelId) {
  const state = activeLiars.get(channelId);
  if (!state) return;
  activeLiars.delete(channelId);
  if (state.votePrefix) for (let i = 0; i < 3; i++) client.interactionHandlers.delete(`${state.votePrefix}_${i}`);

  const winners = [], losers = [];
  for (const [userId, choice] of state.votes.entries()) {
    (choice === state.lieIndex ? winners : losers).push(userId);
  }
  for (const id of winners) incrementWin(interaction.guild.id, id, 'liar');

  const falseStmt = state.statements[state.lieIndex];
  const embed = new EmbedBuilder()
    .setTitle('🏁 Résultat — Deux vérités, un mensonge')
    .setColor(0x00bfae)
    .setDescription(`La fausse affirmation était : **${falseStmt}**`);

  embed.addFields({
    name: '🏆 Gagnants',
    value: winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Personne n\'a trouvé.',
    inline: true,
  });
  if (losers.length) embed.addFields({ name: '❌ Perdants', value: losers.map(id => `<@${id}>`).join(', '), inline: true });

  await interaction.followUp({ embeds: [embed] });
}
