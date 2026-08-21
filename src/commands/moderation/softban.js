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

  // Ban avec purge 7j puis unban immédiat. Si l'unban échoue, on prévient au moins.
  await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: 7 * 24 * 60 * 60 });
  try {
    await interaction.guild.members.unban(target.id, 'Softban — unban automatique');
  } catch (err) {
    logger.error(`[softban] Unban automatique échoué pour ${target.id} : ${err.message}`);
    return interaction.reply({
      content: `⚠️ **${target.tag}** a été banni mais l'unban automatique a échoué. Débannis manuellement via \`/unban ${target.id}\`.`,
      ephemeral: true,
    });
  }
  notifyTarget(target, interaction.guild.name,
    `🧹 Tu as été **softban** (messages 7 derniers jours supprimés).\n> Raison : ${reason}`);

  const { embed } = await finalizeSanction(interaction, { action: 'SOFTBAN', target, reason });
  await interaction.reply({ embeds: [embed] });
}
