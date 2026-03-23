import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { setGuildConfig } from '../../database/repositories/GuildConfigRepository.js';

/**
 * Raccourci pour configurer rapidement le salon des logs.
 * Pour les options avancées, utiliser /config.
 */
export const data = new SlashCommandBuilder()
  .setName('modlogs')
  .setDescription('Définir le salon des logs de modération.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addChannelOption(o => o
    .setName('channel')
    .setDescription('Salon où envoyer les logs')
    .addChannelTypes(ChannelType.GuildText)
    .setRequired(true));

export async function execute(interaction) {
  const channel = interaction.options.getChannel('channel', true);
  setGuildConfig(interaction.guild.id, { modlogs_channel_id: channel.id });
  await interaction.reply({
    content: `✅ Logs de modération configurés dans ${channel}.\n> 💡 Utilisez \`/config\` pour toutes les options de configuration.`,
    ephemeral: true,
  });
}
