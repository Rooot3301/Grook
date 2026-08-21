import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Expulser un utilisateur du serveur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à expulser').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison de l\'expulsion').setRequired(false).setMaxLength(512));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';

  const guard = await runSanctionGuards(interaction, target, 'kickable');
  if (!guard.ok) return;

  await guard.member.kick(reason);
  notifyTarget(target, interaction.guild.name, `👢 Tu as été **expulsé**.\n> Raison : ${reason}`);

  const { embed } = await finalizeSanction(interaction, { action: 'KICK', target, reason });
  await interaction.reply({ embeds: [embed] });
}
