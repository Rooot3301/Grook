import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Fiche du serveur.')
  .addSubcommand(s => s.setName('info').setDescription('Informations générales du serveur.'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'info') return serverInfo(interaction);
}

async function serverInfo(interaction) {
  const { guild } = interaction;
  const owner     = await guild.fetchOwner();

  const embed = new EmbedBuilder()
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setColor(COLORS.INFO)
    .addFields(
      { name: '🆔 ID',           value: guild.id, inline: true },
      { name: '👑 Propriétaire',  value: owner.user.tag, inline: true },
      { name: '👥 Membres',       value: `${guild.memberCount}`, inline: true },
      { name: '💬 Salons',        value: `${guild.channels.cache.size}`, inline: true },
      { name: '🎭 Rôles',         value: `${guild.roles.cache.size - 1}`, inline: true },
      { name: '🚀 Boost',         value: `Niveau ${guild.premiumTier}`, inline: true },
      { name: '📅 Créé le',       value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
