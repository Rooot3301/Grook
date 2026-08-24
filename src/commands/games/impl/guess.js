import { incrementWin } from '../../../database/repositories/StatsRepository.js';

const MAX_TRIES_PER_PLAYER = 10;

export async function execute(interaction) {
  const target = Math.floor(Math.random() * 100) + 1;
  await interaction.reply({
    content: `🔢 Je pense à un nombre entre **1** et **100**. Devine — **60 secondes**, **${MAX_TRIES_PER_PLAYER} essais max** par joueur.`,
  });

  const triesByUser = new Map();
  let found = false;

  const filter    = m => !m.author.bot && /^\d+$/.test(m.content.trim());
  const collector = interaction.channel.createMessageCollector({ filter, time: 60_000 });

  collector.on('collect', msg => {
    const guess = parseInt(msg.content.trim(), 10);
    if (guess < 1 || guess > 100) return;

    const tries = triesByUser.get(msg.author.id) ?? 0;
    if (tries >= MAX_TRIES_PER_PLAYER) {
      // Silencieux volontaire — ne veut pas polluer le salon avec un rappel
      // à chaque essai post-limite. Une réponse mordante au 1er dépassement :
      if (tries === MAX_TRIES_PER_PLAYER) {
        msg.reply({
          content: `⛔ Tu as consommé tes ${MAX_TRIES_PER_PLAYER} essais. Attends un autre joueur ou une prochaine partie.`,
          allowedMentions: { users: [], repliedUser: false },
        });
        triesByUser.set(msg.author.id, tries + 1);
      }
      return;
    }
    triesByUser.set(msg.author.id, tries + 1);

    if (guess === target) {
      found = true;
      incrementWin(interaction.guild.id, msg.author.id, 'guess');
      msg.reply({
        content: `🎉 Bravo <@${msg.author.id}>, c'était bien **${target}** ! (${tries + 1} essai${tries ? 's' : ''})`,
        allowedMentions: { users: [msg.author.id], repliedUser: false },
      });
      collector.stop('found');
      return;
    }

    const hint = guess < target ? '⬆️ Plus haut !' : '⬇️ Plus bas !';
    msg.reply({
      content: hint,
      allowedMentions: { users: [], repliedUser: false },
    });
  });

  collector.on('end', () => {
    if (!found) {
      interaction.followUp({ content: `⏱️ Temps écoulé — le nombre était **${target}**.` });
    }
  });
}
