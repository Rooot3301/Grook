import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('avatar')
  .setDescription('Afficher l\'avatar d\'un utilisateur en haute résolution.')
  .addUserOption(o => o.setName('user').setDescription('Utilisateur cible (soi par défaut)').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;

  const globalAvatar = target.displayAvatarURL({ size: 4096, extension: 'png' });
  const member       = interaction.guild?.members.cache.get(target.id);
  const serverAvatar = member?.displayAvatarURL({ size: 4096, extension: 'png' });

  const embed = new EmbedBuilder()
    .setTitle(`🖼️ Avatar de ${target.tag}`)
    .setColor(COLORS.INFO)
    .setImage(serverAvatar ?? globalAvatar)
    .setTimestamp();

  const links = [`[PNG (global)](${globalAvatar})`];
  if (serverAvatar && serverAvatar !== globalAvatar) {
    links.push(`[PNG (serveur)](${serverAvatar})`);
  }
  embed.setDescription(links.join(' · '));

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
