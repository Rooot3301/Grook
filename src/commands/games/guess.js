import { SlashCommandBuilder } from 'discord.js';
import { incrementWin } from '../../database/repositories/StatsRepository.js';

export const data = new SlashCommandBuilder()
  .setName('grookguess')
  .setDescription('Devinez le nombre auquel pense Grook (avec un soupçon de mensonge).');

export async function execute(interaction) {
  const target = Math.floor(Math.random() * 100) + 1;
  await interaction.reply({ content: '🔢 Je pense à un nombre entre **1** et **100**… devinez ! Vous avez **60 secondes**.' });

  let found = false;
  const filter    = m => !m.author.bot && /^\d+$/.test(m.content.trim());
  const collector = interaction.channel.createMessageCollector({ filter, time: 60_000 });

  collector.on('collect', msg => {
    const guess = parseInt(msg.content.trim(), 10);
    if (guess < 1 || guess > 100) return;

    if (guess === target) {
      found = true;
      incrementWin(interaction.guild.id, msg.author.id, 'guess');
      msg.reply({ content: `🎉 Bravo <@${msg.author.id}>, le nombre était bien **${target}** !`, allowedMentions: { users: [msg.author.id] } });
      collector.stop('found');
    } else {
      // 10% de chance de mentir
      const lie  = Math.random() < 0.1;
      const real = guess < target ? 'Plus haut !' : 'Plus bas !';
      const hint = lie ? (guess < target ? 'Plus bas !' : 'Plus haut !') : real;
      msg.reply({ content: hint, allowedMentions: { users: [msg.author.id] } });
    }
  });

  collector.on('end', (_, reason) => {
    if (!found) {
      interaction.followUp({ content: `⏱️ Temps écoulé ! Le nombre était **${target}**.` });
    }
  });
}
