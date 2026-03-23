import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Créer un sondage avec jusqu\'à 4 options.')
  .addStringOption(o => o.setName('question').setDescription('Question du sondage').setRequired(true))
  .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
  .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
  .addStringOption(o => o.setName('option3').setDescription('Option 3 (facultatif)').setRequired(false))
  .addStringOption(o => o.setName('option4').setDescription('Option 4 (facultatif)').setRequired(false))
  .addIntegerOption(o => o.setName('duree').setDescription('Durée en minutes (défaut : 5)').setMinValue(1).setMaxValue(60).setRequired(false));

const OPTION_EMOJIS = ['🇦', '🇧', '🇨', '🇩'];

export async function execute(interaction, client) {
  const question = interaction.options.getString('question', true);
  const duration = (interaction.options.getInteger('duree') ?? 5) * 60_000;

  const options = [
    interaction.options.getString('option1'),
    interaction.options.getString('option2'),
    interaction.options.getString('option3'),
    interaction.options.getString('option4'),
  ].filter(Boolean);

  const pollId   = `poll_${Date.now()}`;
  const votes    = new Map(); // userId → optionIndex
  const counts   = new Array(options.length).fill(0);
  const endsAt   = Math.floor((Date.now() + duration) / 1000);

  const buildEmbed = () => {
    const total = counts.reduce((a, b) => a + b, 0);
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .setColor(COLORS.FUN)
      .setDescription(options.map((opt, i) => {
        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
        return `${OPTION_EMOJIS[i]} **${opt}**\n\`${bar}\` ${pct}% (${counts[i]} vote${counts[i] !== 1 ? 's' : ''})`;
      }).join('\n\n'))
      .setFooter({ text: `${total} vote(s) au total` })
      .setTimestamp();
    return embed;
  };

  const row = new ActionRowBuilder().addComponents(
    options.map((opt, i) =>
      new ButtonBuilder()
        .setCustomId(`${pollId}_${i}`)
        .setLabel(opt.length > 80 ? opt.slice(0, 77) + '…' : opt)
        .setEmoji(OPTION_EMOJIS[i])
        .setStyle(ButtonStyle.Secondary)
    )
  );

  const msg = await interaction.reply({ embeds: [buildEmbed()], components: [row], fetchReply: true });

  for (let i = 0; i < options.length; i++) {
    client.interactionHandlers.set(`${pollId}_${i}`, async btn => {
      const prev = votes.get(btn.user.id);
      if (prev === i) {
        // Annuler son vote
        votes.delete(btn.user.id);
        counts[i]--;
        await btn.reply({ content: '✅ Vote retiré.', ephemeral: true });
      } else {
        if (prev !== undefined) counts[prev]--;
        votes.set(btn.user.id, i);
        counts[i]++;
        await btn.reply({ content: `✅ Vote pour **${OPTION_EMOJIS[i]} ${options[i]}** enregistré.`, ephemeral: true });
      }
      await msg.edit({ embeds: [buildEmbed()], components: [row] }).catch(() => {});
    });
  }

  // Clôture automatique
  setTimeout(async () => {
    for (let i = 0; i < options.length; i++) client.interactionHandlers.delete(`${pollId}_${i}`);
    const total     = counts.reduce((a, b) => a + b, 0);
    const maxVotes  = Math.max(...counts);
    const winners   = options.filter((_, i) => counts[i] === maxVotes);

    const finalEmbed = buildEmbed()
      .setTitle(`📊 [TERMINÉ] ${question}`)
      .setColor(COLORS.SUCCESS)
      .setFooter({ text: `Sondage terminé · ${total} vote(s)` });

    if (maxVotes > 0) {
      finalEmbed.addFields({ name: '🏆 Résultat', value: winners.map(w => `**${w}**`).join(' et ') });
    }

    await msg.edit({ embeds: [finalEmbed], components: [] }).catch(() => {});
  }, duration);
}
