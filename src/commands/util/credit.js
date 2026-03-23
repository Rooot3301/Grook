import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { VERSION, BUILD_DATE, CHANGELOG } from '../../version.js';
import { COLORS } from '../../utils/embeds.js';

// ID Discord du créateur — configurez BOT_OWNER_ID dans .env pour la mention
const OWNER_MENTION = process.env.BOT_OWNER_ID
  ? `<@${process.env.BOT_OWNER_ID}>`
  : '**Root3301**';

export const data = new SlashCommandBuilder()
  .setName('credit')
  .setDescription('Afficher les crédits et l\'historique des versions de Grook.');

export async function execute(interaction) {
  const latest = CHANGELOG[0];
  const changeList = latest?.changes.map(c => `• ${c}`).join('\n') ?? '—';

  const embed = new EmbedBuilder()
    .setTitle(`🤖 Grook Bot — v${VERSION}`)
    .setThumbnail(interaction.client.user.displayAvatarURL({ size: 256 }))
    .setColor(COLORS.INFO)
    .setDescription(
      `Grook est un bot Discord multifonctions conçu par ${OWNER_MENTION}.\n` +
      `Modération, mini-jeux, fun — tout ce qu'il vous faut dans un seul bot.`
    )
    .addFields(
      {
        name: '👨‍💻 Créateur',
        value: `${OWNER_MENTION}`,
        inline: true,
      },
      {
        name: '📦 Version actuelle',
        value: `\`v${VERSION}\` — ${BUILD_DATE}`,
        inline: true,
      },
      {
        name: `🆕 Nouveautés v${latest?.version ?? VERSION}`,
        value: changeList,
        inline: false,
      },
    )
    .setFooter({ text: `Grook v${VERSION} · Construit avec discord.js v14 + Node.js` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
