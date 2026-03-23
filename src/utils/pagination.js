import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Envoie une réponse paginée avec boutons Précédent / Suivant.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {any[]} items          Tous les éléments à paginer
 * @param {(slice: any[], pageNum: number, totalPages: number) => import('discord.js').EmbedBuilder} buildEmbed
 * @param {object}  [opts]
 * @param {number}  [opts.perPage=5]    Éléments par page
 * @param {boolean} [opts.ephemeral=true]
 * @param {number}  [opts.timeout=60000] Durée de vie des boutons (ms)
 */
export async function sendPaginated(interaction, items, buildEmbed, opts = {}) {
  const { perPage = 5, ephemeral = true, timeout = 60_000 } = opts;
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  let page = 0;

  const slice  = () => items.slice(page * perPage, (page + 1) * perPage);
  const embed  = () => buildEmbed(slice(), page + 1, totalPages);
  const row    = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pag_prev')
      .setEmoji('◀️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('pag_info')
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('pag_next')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages - 1),
  );

  const msg = await interaction.reply({
    embeds:     [embed()],
    components: totalPages > 1 ? [row()] : [],
    ephemeral,
    fetchReply: true,
  });

  if (totalPages <= 1) return;

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith('pag_'),
    time: timeout,
  });

  collector.on('collect', async i => {
    if (i.customId === 'pag_prev') page = Math.max(0, page - 1);
    if (i.customId === 'pag_next') page = Math.min(totalPages - 1, page + 1);
    await i.update({ embeds: [embed()], components: [row()] });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
  });
}
