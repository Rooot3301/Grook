import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Signaler un utilisateur aux modérateurs (envoyé discrètement dans modlogs).')
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à signaler').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du signalement').setRequired(true).setMaxLength(500));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

  if (target.id === interaction.user.id) {
    return interaction.reply({ content: '❌ Vous ne pouvez pas vous signaler vous-même.', ephemeral: true });
  }
  if (target.bot) {
    return interaction.reply({ content: '❌ Vous ne pouvez pas signaler un bot.', ephemeral: true });
  }

  const config = getGuildConfig(interaction.guild.id);
  if (!config.modlogs_channel_id) {
    return interaction.reply({
      content: '❌ Aucun salon de modlogs configuré sur ce serveur. Contactez un modérateur directement.',
      ephemeral: true,
    });
  }

  const channel = interaction.guild.channels.cache.get(config.modlogs_channel_id);
  if (!channel?.isTextBased()) {
    return interaction.reply({ content: '❌ Le salon de modlogs est introuvable.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🚨 Nouveau signalement')
    .setColor(COLORS.WARNING)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Utilisateur signalé', value: `${target.tag}\n<@${target.id}>`, inline: true },
      { name: '📣 Signalé par',         value: `${interaction.user.tag}\n<@${interaction.user.id}>`, inline: true },
      { name: '\u200B',                  value: '\u200B', inline: true },
      { name: '📝 Motif',               value: reason, inline: false },
      { name: '📍 Salon',               value: `<#${interaction.channel.id}>`, inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `ID cible : ${target.id}` });

  await channel.send({ embeds: [embed] });

  await interaction.reply({
    content: '✅ Votre signalement a été transmis aux modérateurs. Merci.',
    ephemeral: true,
  });
}
