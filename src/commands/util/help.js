import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { VERSION } from '../../version.js';
import { COLORS } from '../../utils/embeds.js';

const CATEGORY_META = {
  moderation: { icon: '🛡️', label: 'Modération' },
  config:     { icon: '⚙️', label: 'Configuration' },
  fun:        { icon: '🎭', label: 'Fun' },
  games:      { icon: '🎮', label: 'Mini-jeux' },
  util:       { icon: '🔧', label: 'Utilitaires' },
};

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Afficher la liste des commandes disponibles.');

export async function execute(interaction, client) {
  const embed = new EmbedBuilder()
    .setTitle(`📖 Aide — Grook v${VERSION}`)
    .setColor(COLORS.INFO)
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription('Toutes les commandes disponibles, organisées par catégorie.')
    .setFooter({ text: `${client.guilds.cache.size} serveur(s) · /config pour la configuration · /credit pour les infos` })
    .setTimestamp();

  for (const [category, cmds] of client.commandCategories) {
    const meta = CATEGORY_META[category] ?? { icon: '📁', label: category };
    const list = cmds.map(cmd => `\`/${cmd}\``).join(', ');
    embed.addFields({ name: `${meta.icon} ${meta.label}`, value: list, inline: false });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
