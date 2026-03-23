import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('grookquote')
  .setDescription('Citer un message de façon stylée.')
  .addStringOption(o => o
    .setName('message')
    .setDescription('Lien ou ID du message à citer')
    .setRequired(true));

export async function execute(interaction) {
  const input = interaction.options.getString('message', true).trim();
  let channelId, messageId;

  if (input.includes('discord.com/channels/')) {
    const parts = input.split('/');
    messageId = parts.pop();
    channelId = parts.pop();
  } else {
    messageId = input;
    channelId = interaction.channel.id;
  }

  // Validation basique
  if (!/^\d{17,20}$/.test(messageId) || !/^\d{17,20}$/.test(channelId)) {
    return interaction.reply({ content: '❌ Lien ou ID invalide.', ephemeral: true });
  }

  try {
    const channel = await interaction.client.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw new Error('Salon invalide');
    const message = await channel.messages.fetch(messageId);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setDescription(message.content || '*(Message sans texte)*')
      .setFooter({ text: `dans #${channel.name}` })
      .setTimestamp(message.createdTimestamp);

    if (message.attachments.size > 0) {
      const img = message.attachments.find(a => a.contentType?.startsWith('image/'));
      if (img) embed.setImage(img.url);
    }

    await interaction.reply({ embeds: [embed] });
  } catch {
    await interaction.reply({ content: '❌ Impossible de récupérer ce message. Vérifie que j\'ai accès au salon.', ephemeral: true });
  }
}
