import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    const config = getGuildConfig(member.guild.id);
    if (!config.welcome_channel_id) return;

    const channel = member.guild.channels.cache.get(config.welcome_channel_id);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(`👋 Bienvenue sur ${member.guild.name} !`)
      .setDescription(
        `Bienvenue <@${member.id}> ! Tu es le **${member.guild.memberCount}ème** membre du serveur.`
      )
      .setColor(0x57F287)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
    } catch { /* salon inaccessible — ignorer */ }
  },
};
