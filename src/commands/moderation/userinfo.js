import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/embeds.js';

const MAX_ROLES_SHOWN = 15;

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('Afficher les informations d\'un utilisateur.')
  .addUserOption(o => o
    .setName('user')
    .setDescription('Utilisateur ciblé (toi-même si vide)')
    .setRequired(false));

export async function execute(interaction) {
  const user   = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle(user.tag)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setColor(member?.displayHexColor ?? COLORS.INFO)
    .addFields(
      { name: '🆔 ID',             value: user.id,                                                     inline: true },
      { name: '📅 Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,          inline: true },
    )
    .setTimestamp();

  if (member) {
    const allRoles = member.roles.cache.filter(r => r.id !== interaction.guild.id);
    const shown    = allRoles.first(MAX_ROLES_SHOWN).map(r => r.toString());
    const overflow = Math.max(0, allRoles.size - shown.length);

    embed.addFields(
      { name: '📥 Rejoint le', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
      {
        name:  `🎭 Rôles (${allRoles.size})`,
        value: shown.length ? shown.join(' ') + (overflow > 0 ? ` *+${overflow}*` : '') : 'Aucun',
        inline: false,
      },
    );
    if (member.nickname) embed.addFields({ name: '✏️ Pseudo', value: member.nickname, inline: true });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
