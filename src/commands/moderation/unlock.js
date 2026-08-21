import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Déverrouiller un salon.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o
    .setName('channel')
    .setDescription('Salon à déverrouiller (défaut : salon actuel)')
    .addChannelTypes(ChannelType.GuildText)
    .setRequired(false))
  .addStringOption(o => o.setName('reason').setDescription('Raison').setMaxLength(300));

export async function execute(interaction) {
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
