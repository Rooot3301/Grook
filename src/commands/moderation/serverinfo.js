import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Afficher des informations sur le serveur.');

export async function execute(interaction) {
  const { guild } = interaction;
  const owner = await guild.fetchOwner();

  const embed = new EmbedBuilder()
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setColor(0x5865F2)
    .addFields(
      { name: '🆔 ID',           value: guild.id,                                              inline: true },
      { name: '👑 Propriétaire', value: owner.user.tag,                                        inline: true },
      { name: '👥 Membres',      value: `${guild.memberCount}`,                                inline: true },
      { name: '💬 Salons',       value: `${guild.channels.cache.size}`,                        inline: true },
      { name: '🎭 Rôles',        value: `${guild.roles.cache.size - 1}`,                       inline: true },
      { name: '🚀 Boost',        value: `Niveau ${guild.premiumTier}`,                         inline: true },
      { name: '📅 Créé le',      value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,  inline: false },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
