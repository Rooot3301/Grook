import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('grookquote')
  .setDescription('Citer un message de ce serveur de façon stylée.')
  .addStringOption(o => o
    .setName('message')
    .setDescription('Lien ou ID du message à citer')
    .setRequired(true));

export async function execute(interaction) {
  const input = interaction.options.getString('message', true).trim();
  let channelId, messageId, guildIdFromLink = null;

  if (input.includes('discord.com/channels/')) {
    const parts = input.split('/');
    messageId       = parts.pop();
    channelId       = parts.pop();
    guildIdFromLink = parts.pop();
  } else {
    messageId = input;
    channelId = interaction.channel.id;
  }

  if (!/^\d{17,20}$/.test(messageId) || !/^\d{17,20}$/.test(channelId)) {
    return interaction.reply({ embeds: [errorEmbed('Lien ou ID invalide.')], ephemeral: true });
  }
  if (guildIdFromLink && guildIdFromLink !== interaction.guild.id) {
    return interaction.reply({ embeds: [errorEmbed('Impossible de citer un message d\'un autre serveur.')], ephemeral: true });
  }

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel?.isTextBased()) {
    return interaction.reply({ embeds: [errorEmbed('Salon introuvable ou non textuel dans ce serveur.')], ephemeral: true });
  }

  let message;
  try {
    message = await channel.messages.fetch(messageId);
  } catch {
    return interaction.reply({ embeds: [errorEmbed('Message introuvable. Vérifie que j\'ai accès au salon.')], ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
    .setDescription(message.content || '*(Message sans texte)*')
    .setFooter({ text: `dans #${channel.name}` })
    .setTimestamp(message.createdTimestamp);

  if (message.attachments.size > 0) {
    const img = message.attachments.find(a => a.contentType?.startsWith('image/'));
    if (img) embed.setImage(img.url);
  }

  await interaction.reply({ embeds: [embed] });
}
