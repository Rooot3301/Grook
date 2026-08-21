import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { parseDuration, formatDuration } from '../../utils/time.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const MAX_SLOWMODE_S = 21600;

export const data = new SlashCommandBuilder()
  .setName('channel')
  .setDescription('Actions sur un salon — lock, unlock, slowmode.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addSubcommand(s => s
    .setName('lock')
    .setDescription('Verrouiller un salon (empêcher les messages).')
    .addChannelOption(o => o.setName('channel').setDescription('Salon (défaut : salon actuel)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Raison').setMaxLength(300)))
  .addSubcommand(s => s
    .setName('unlock')
    .setDescription('Déverrouiller un salon.')
    .addChannelOption(o => o.setName('channel').setDescription('Salon (défaut : salon actuel)').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Raison').setMaxLength(300)))
  .addSubcommand(s => s
    .setName('slowmode')
    .setDescription('Définir le mode lent (durée par message ou 0 pour désactiver).')
    .addStringOption(o => o.setName('duree').setDescription('Ex: 5s, 10m, 1h, 0 pour désactiver').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Salon (défaut : salon actuel)').addChannelTypes(ChannelType.GuildText).setRequired(false)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'lock')     return lockChannel(interaction);
  if (sub === 'unlock')   return unlockChannel(interaction);
  if (sub === 'slowmode') return slowmodeChannel(interaction);
}

async function lockChannel(interaction) {
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const reason  = interaction.options.getString('reason') || 'Aucune raison';
  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
  } catch {
    return interaction.reply({ embeds: [errorEmbed('Impossible de verrouiller ce salon.')], ephemeral: true });
  }
  await logChannelAction(interaction.client, interaction.guild, {
    action: 'LOCK', channel, moderator: interaction.user, reason,
  });
  await interaction.reply({ embeds: [successEmbed(`${channel} verrouillé. Raison : ${reason}`)] });
}

async function unlockChannel(interaction) {
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const reason  = interaction.options.getString('reason') || 'Aucune raison';
  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
  } catch {
    return interaction.reply({ embeds: [errorEmbed('Impossible de déverrouiller ce salon.')], ephemeral: true });
  }
  await logChannelAction(interaction.client, interaction.guild, {
    action: 'UNLOCK', channel, moderator: interaction.user, reason,
  });
  await interaction.reply({ embeds: [successEmbed(`${channel} déverrouillé.`)] });
}

async function slowmodeChannel(interaction) {
  const raw     = interaction.options.getString('duree', true).trim();
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;

  let seconds;
  if (raw === '0') {
    seconds = 0;
  } else {
    const ms = parseDuration(raw);
    if (!ms) return interaction.reply({ embeds: [errorEmbed('Durée invalide. Ex : `5s`, `10m`, `1h`, `0` pour désactiver.')], ephemeral: true });
    seconds = Math.floor(ms / 1000);
    if (seconds > MAX_SLOWMODE_S) return interaction.reply({ embeds: [errorEmbed('Durée max : 6h (21600s).')], ephemeral: true });
  }

  try { await channel.setRateLimitPerUser(seconds); }
  catch { return interaction.reply({ embeds: [errorEmbed('Impossible de modifier le slowmode.')], ephemeral: true }); }

  const formatted = seconds === 0 ? 'désactivé' : formatDuration(seconds * 1000);
  await logChannelAction(interaction.client, interaction.guild, {
    action: 'SLOWMODE', channel, moderator: interaction.user,
    reason: `Slowmode : ${formatted}`,
    extra: { '🐌 Slowmode': formatted },
  });
  await interaction.reply({ embeds: [successEmbed(`Slowmode dans ${channel} : **${formatted}**.`)] });
}
