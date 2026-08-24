import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('softban')
  .setDescription('Ban + unban immédiat pour purger 7 jours de messages.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à softban').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du softban').setRequired(false).setMaxLength(512));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';

  const guard = await runSanctionGuards(interaction, target, 'bannable');
  if (!guard.ok) return;

  // Étape 1 : ban avec purge 7j
  try {
    await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: 7 * 24 * 60 * 60 });
  } catch (err) {
    return interaction.reply({
      content: `❌ Discord a refusé le ban : \`${err.message}\`. Aucun changement.`,
      ephemeral: true,
    });
  }

  // Étape 2 : unban immédiat (softban = ban éphémère qui purge)
  // Peu importe le résultat, on finalize le case pour tracer l'action.
  // Si l'unban échoue, on notifie le modo qui pourra unban manuellement via /unban.
  let unbanOk = false;
  try {
    await interaction.guild.members.unban(target.id, 'Softban — unban automatique');
    unbanOk = true;
  } catch (err) {
    logger.error(`[softban] Unban auto échoué pour ${target.id} : ${err.message}. Le case est finalisé, unban à faire à la main.`);
  }

  notifyTarget(target, interaction.guild.name,
    `🧹 Tu as été **softban** (messages 7 derniers jours supprimés).\n> Raison : ${reason}`);

  // Finalisation du case dans TOUS les cas — l'action est traçable.
  const { embed } = await finalizeSanction(interaction, {
    action: 'SOFTBAN', target, reason,
    extra: unbanOk ? undefined : { '⚠️ État': 'Unban auto ÉCHOUÉ — utilise `/unban`' },
  });

  await interaction.reply({
    embeds: [embed],
    content: unbanOk ? undefined
      : `⚠️ Le softban a été **appliqué mais l'unban automatique a échoué**. Débannis manuellement via \`/unban userid:${target.id}\`.`,
  });
}
