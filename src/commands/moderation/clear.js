import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const MAX_FETCH_PAGES = 10; // 10 * 100 = 1000 messages max scannés
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Supprimer des messages dans le salon courant.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption(o => o
    .setName('nombre')
    .setDescription('Nombre de messages à supprimer (1-100)')
    .setMinValue(1).setMaxValue(100)
    .setRequired(true))
  .addUserOption(o => o
    .setName('user')
    .setDescription('Ne supprimer que les messages de cet utilisateur (scanne jusqu\'à 1000 messages)'));

export async function execute(interaction) {
  const amount = interaction.options.getInteger('nombre', true);
  const only   = interaction.options.getUser('user');
  await interaction.deferReply({ ephemeral: true });

  try {
    let deletedCount;

    if (only) {
      // ── Filtrage par auteur avec pagination réelle ─────────────────────
      // Discord bulkDelete rejette les messages > 14j, on filtre aussi.
      const cutoff  = Date.now() - FOURTEEN_DAYS_MS;
      const toDelete = [];
      let cursor    = null;
      let scanned   = 0;

      for (let page = 0; page < MAX_FETCH_PAGES && toDelete.length < amount; page++) {
        const fetchOpts = { limit: 100, ...(cursor ? { before: cursor } : {}) };
        const batch     = await interaction.channel.messages.fetch(fetchOpts);
        if (batch.size === 0) break;

        scanned += batch.size;
        for (const msg of batch.values()) {
          if (toDelete.length >= amount) break;
          if (msg.author.id !== only.id) continue;
          if (msg.createdTimestamp < cutoff) continue; // trop vieux → non supprimable par bulkDelete
          toDelete.push(msg);
        }
        cursor = batch.last()?.id;
        if (!cursor) break;
      }

      if (toDelete.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed(`Aucun message récent de ${only.tag} trouvé (scanné ${scanned} messages, > 14j exclus).`)],
        });
      }

      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      deletedCount = deleted.size;

      await logChannelAction(interaction.client, interaction.guild, {
        action: 'CLEAR', channel: interaction.channel, moderator: interaction.user,
        reason: `Purge de ${deletedCount} message(s) de ${only.tag}`,
        extra: {
          '🧹 Supprimés': `${deletedCount}/${amount} demandés`,
          '🔎 Scannés':   `${scanned}`,
          '👤 Cible':     `<@${only.id}>`,
        },
      });
      return interaction.editReply({
        embeds: [successEmbed(`**${deletedCount}** message(s) de ${only.tag} supprimé(s) (${scanned} scannés).`)],
      });
    }

    // ── Sans filtre : bulkDelete direct ───────────────────────────────────
    const deleted = await interaction.channel.bulkDelete(amount, true);
    deletedCount  = deleted.size;
    if (deletedCount === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Aucun message supprimable (probablement > 14 jours).')] });
    }

    await logChannelAction(interaction.client, interaction.guild, {
      action: 'CLEAR', channel: interaction.channel, moderator: interaction.user,
      reason: `Purge de ${deletedCount} message(s)`,
      extra: { '🧹 Supprimés': `${deletedCount}` },
    });
    await interaction.editReply({ embeds: [successEmbed(`**${deletedCount}** message(s) supprimé(s).`)] });
  } catch (err) {
    if (err.code === 50034) {
      return interaction.editReply({ embeds: [errorEmbed('Impossible de supprimer des messages de plus de 14 jours.')] });
    }
    await interaction.editReply({ embeds: [errorEmbed('Impossible de supprimer les messages.')] });
  }
}
