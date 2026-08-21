import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const MAX_SLOWMODE_S = 21600; // 6h (limite Discord)

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Définir le mode lent dans un salon.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(o => o
    .setName('duree')
    .setDescription('Durée par message (ex: 5s, 10m, 1h) — 0 pour désactiver')
    .setRequired(true))
  .addChannelOption(o => o
    .setName('channel')
    .setDescription('Salon cible (défaut : salon actuel)')
    .addChannelTypes(ChannelType.GuildText)
    .setRequired(false));

export async function execute(interaction) {
  const raw     = interaction.options.getString('duree', true).trim();
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;

  let seconds;
  if (raw === '0') {
    seconds = 0;
  } else {
    const ms = parseDuration(raw);
    if (!ms) return interaction.reply({ embeds: [errorEmbed('Durée invalide. Exemples : `5s`, `10m`, `1h`, `0` pour désactiver.')], ephemeral: true });
    seconds = Math.floor(ms / 1000);
    if (seconds > MAX_SLOWMODE_S) return interaction.reply({ embeds: [errorEmbed('Durée max : 6h (21600s).')], ephemeral: true });
  }

  try {
    await channel.setRateLimitPerUser(seconds);
  } catch {
    return interaction.reply({ embeds: [errorEmbed('Impossible de modifier le slowmode.')], ephemeral: true });
  }

  const formatted = seconds === 0 ? 'désactivé' : formatDuration(seconds * 1000);
  await logChannelAction(interaction.client, interaction.guild, {
    action: 'SLOWMODE', channel, moderator: interaction.user,
    reason: `Slowmode : ${formatted}`,
    extra: { '🐌 Slowmode': formatted },
  });

  await interaction.reply({ embeds: [successEmbed(`Slowmode dans ${channel} : **${formatted}**.`)] });
}
