import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Afficher des informations sur un utilisateur.')
  .addUserOption(o => o
    .setName('user')
    .setDescription('Utilisateur ciblé (vous-même si vide)')
    .setRequired(false));

export async function execute(interaction) {
  const user   = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle(user.tag)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setColor(member?.displayHexColor ?? 0x5865F2)
    .addFields(
      { name: '🆔 ID',            value: user.id,                                                     inline: true },
      { name: '📅 Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,         inline: true },
    )
    .setTimestamp();

  if (member) {
    const roles = member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.toString());
    embed.addFields(
      { name: '📥 Rejoint le', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
      { name: '🎭 Rôles',      value: roles.length ? roles.slice(0, 15).join(' ') : 'Aucun', inline: false },
    );
    if (member.nickname) embed.addFields({ name: '✏️ Pseudo', value: member.nickname, inline: true });
  }

  await interaction.reply({ embeds: [embed] });
}
