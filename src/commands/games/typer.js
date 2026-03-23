import { SlashCommandBuilder } from 'discord.js';
import { incrementWin } from '../../database/repositories/StatsRepository.js';

const PHRASES = [
  'La vie est un jeu, et Grook triche.',
  'Un canard en plastique peut te sauver la vie.',
  'Javascript est parfois bizarre.',
  'Never gonna give you up, never gonna let you down.',
  'Grook regarde vos DM en secret (ou pas).',
  'La modération c\'est un art, pas un sport de combat.',
  'Le meilleur bot, c\'est celui qui répond.',
];

export const data = new SlashCommandBuilder()
  .setName('grooktyper')
  .setDescription('Testez votre vitesse de frappe — le premier à recopier la phrase gagne !');

export async function execute(interaction) {
  const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  await interaction.reply({
    content: `⌨️ Premier à écrire **exactement** :\n> ${phrase}\n\nVous avez **30 secondes** !`,
  });

  const filter = msg => !msg.author.bot && msg.content.trim() === phrase;
  try {
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30_000, errors: ['time'] });
    const winner    = collected.first();
    incrementWin(interaction.guild.id, winner.author.id, 'typer');
    await interaction.followUp({ content: `🎉 Bravo <@${winner.author.id}>, tu as gagné !`, allowedMentions: { users: [winner.author.id] } });
  } catch {
    await interaction.followUp({ content: '⏱️ Personne n\'a réussi à taper la phrase à temps.' });
  }
}
