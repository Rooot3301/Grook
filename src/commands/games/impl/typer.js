import { incrementWin } from '../../../database/repositories/StatsRepository.js';

const PHRASES = [
  'La vie est un jeu, et Grook triche.',
  'Un canard en plastique peut te sauver la vie.',
  'JavaScript est parfois bizarre.',
  'Never gonna give you up, never gonna let you down.',
  'Grook regarde vos DM en secret (ou pas).',
  'La modération c\'est un art, pas un sport de combat.',
  'Le meilleur bot, c\'est celui qui répond.',
  'Un serveur Discord sans mods, c\'est une jungle avec du wifi.',
  'La roulette russe virtuelle, c\'est comme la vraie mais avec moins de conséquences.',
];

// Normalise pour comparaison indulgente : casse et accents ignorés,
// espaces multiples réduits. Ponctuation conservée (fait partie du défi).
function normalize(s) {
  return s
    .normalize('NFD').replace(/\p{M}/gu, '')  // strip diacritics
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export async function execute(interaction) {
  const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  const expected = normalize(phrase);

  await interaction.reply({
    content: `⌨️ Premier à retaper (la casse et les accents ne comptent pas) :\n> ${phrase}\n\n**30 secondes**.`,
  });

  const filter = msg => !msg.author.bot && normalize(msg.content) === expected;
  try {
    const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30_000, errors: ['time'] });
    const winner    = collected.first();
    incrementWin(interaction.guild.id, winner.author.id, 'typer');
    await interaction.followUp({
      content: `🎉 Bravo <@${winner.author.id}>, tu as gagné !`,
      allowedMentions: { users: [winner.author.id] },
    });
  } catch {
    await interaction.followUp({ content: `⏱️ Personne n'a réussi à taper la phrase à temps.\n> ${phrase}` });
  }
}
