import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { createReminder } from '../../database/repositories/ReminderRepository.js';
import { scheduleReminder } from '../../features/reminders.js';
import { COLORS } from '../../utils/embeds.js';

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Programmer un rappel dans ce salon.')
  .addStringOption(o => o.setName('duree').setDescription('Dans combien de temps (ex: 10m, 2h, 1d)').setRequired(true))
  .addStringOption(o => o.setName('message').setDescription('Message du rappel').setRequired(true).setMaxLength(300));

export async function execute(interaction, client) {
  const durationStr = interaction.options.getString('duree', true);
  const message     = interaction.options.getString('message', true);
  const ms          = parseDuration(durationStr);

  if (!ms) return interaction.reply({ content: '❌ Durée invalide. Exemples : `10m`, `2h`, `3d`.', ephemeral: true });
  if (ms < 60_000) return interaction.reply({ content: '❌ Durée minimale : 1 minute.', ephemeral: true });
  if (ms > MAX_DURATION_MS) return interaction.reply({ content: '❌ Durée maximale : 30 jours.', ephemeral: true });

  const firesAt  = Date.now() + ms;
  const reminder = createReminder({
    userId:    interaction.user.id,
    channelId: interaction.channel.id,
    guildId:   interaction.guild.id,
    message,
    firesAt,
  });

  scheduleReminder(client, reminder);

  const formatted = formatDuration(ms);
  const embed = new EmbedBuilder()
    .setTitle('⏰ Rappel programmé')
    .setColor(COLORS.SUCCESS)
    .addFields(
      { name: '📝 Message', value: message, inline: false },
      { name: '⏱️ Dans',    value: formatted, inline: true },
      { name: '🕐 Le',      value: `<t:${Math.floor(firesAt / 1000)}:F>`, inline: true },
    )
    .setFooter({ text: `ID rappel : ${reminder.id}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
