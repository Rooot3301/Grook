import { incrementWin } from '../../../database/repositories/StatsRepository.js';

export async function execute(interaction) {
  const target = Math.floor(Math.random() * 100) + 1;
  await interaction.reply({
    content: '🔢 Je pense à un nombre entre **1** et **100**. Devine — **60 secondes**.',
  });

  let found = false;
  const filter    = m => !m.author.bot && /^\d+$/.test(m.content.trim());
  const collector = interaction.channel.createMessageCollector({ filter, time: 60_000 });

  collector.on('collect', msg => {
    const guess = parseInt(msg.content.trim(), 10);
    if (guess < 1 || guess > 100) return;

    if (guess === target) {
      found = true;
      incrementWin(interaction.guild.id, msg.author.id, 'guess');
      msg.reply({
        content: `🎉 Bravo <@${msg.author.id}>, c'était bien **${target}** !`,
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
