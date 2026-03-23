import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getStatsForGuild, getStatsForUser } from '../../database/repositories/StatsRepository.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('grookstats')
  .setDescription('Voir le classement des mini-jeux du serveur ou les stats d\'un joueur.')
  .addUserOption(o => o.setName('user').setDescription('Voir les stats d\'un joueur spécifique').setRequired(false));

export async function execute(interaction) {
  const targetUser = interaction.options.getUser('user');

  // ── Stats individuelles ────────────────────────────────────────────────────
  if (targetUser) {
    const games = getStatsForUser(interaction.guild.id, targetUser.id);
    const embed = new EmbedBuilder()
      .setTitle(`🎮 Stats de ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor(COLORS.GAME)
      .setTimestamp();

    if (!Object.keys(games).length) {
      embed.setDescription('Aucune victoire enregistrée pour ce joueur.');
    } else {
      const total = Object.values(games).reduce((a, b) => a + b, 0);
      const lines = Object.entries(games)
        .sort((a, b) => b[1] - a[1])
        .map(([game, wins]) => `**${game}** — ${wins} victoire${wins !== 1 ? 's' : ''}`);
      embed
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Total : ${total} victoire(s)` });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── Classement du serveur ──────────────────────────────────────────────────
  const stats = getStatsForGuild(interaction.guild.id);
  const embed = new EmbedBuilder()
    .setTitle('🏆 Classement des mini-jeux')
    .setColor(COLORS.GAME);

  if (!Object.keys(stats).length) {
    embed.setDescription('Aucune statistique enregistrée. Jouez à `/grookroulette`, `/grookguess` ou `/grooktyper` !');
    return interaction.reply({ embeds: [embed] });
  }

  const MEDALS = ['🥇', '🥈', '🥉'];
  const totals = Object.entries(stats)
    .map(([userId, games]) => ({
      userId,
      total: Object.values(games).reduce((a, b) => a + b, 0),
      games,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const lines = totals.map((e, i) => {
    const tag    = interaction.guild.members.cache.get(e.userId)?.user.tag ?? `<@${e.userId}>`;
    const detail = Object.entries(e.games).map(([g, w]) => `${g}:${w}`).join(' | ');
    return `${MEDALS[i] ?? `**${i + 1}.**`} **${tag}** — ${e.total} victoire(s) (${detail})`;
  });

  embed.setDescription(lines.join('\n'));
  await interaction.reply({ embeds: [embed] });
}
