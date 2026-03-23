import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Définir le mode lent dans un salon.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addChannelOption(o => o
    .setName('channel')
    .setDescription('Salon cible')
    .addChannelTypes(ChannelType.GuildText)
    .setRequired(true))
  .addIntegerOption(o => o
    .setName('secondes')
    .setDescription('Délai en secondes (0 = désactiver)')
    .setMinValue(0)
    .setMaxValue(21600)
    .setRequired(true));

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  const seconds = interaction.options.getInteger('secondes', true);
  try {
    await channel.setRateLimitPerUser(seconds);
    const msg = seconds === 0
      ? `✅ Slowmode désactivé dans ${channel}.`
      : `✅ Slowmode défini à **${seconds}s** dans ${channel}.`;
    await interaction.reply({ content: msg });
  } catch {
    await interaction.reply({ content: '❌ Impossible de modifier le slowmode.', ephemeral: true });
  }
}
