import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Bannir un utilisateur définitivement.')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à bannir').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du bannissement').setRequired(false).setMaxLength(512))
  .addIntegerOption(o => o
    .setName('purge')
    .setDescription('Supprimer les messages des N derniers jours (0-7)')
    .setMinValue(0).setMaxValue(7).setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';
  const purge  = interaction.options.getInteger('purge') ?? 0;

  const guard = await runSanctionGuards(interaction, target, 'bannable');
  if (!guard.ok) return;

  await guard.member.ban({ reason, deleteMessageSeconds: purge * 24 * 60 * 60 });
  notifyTarget(target, interaction.guild.name, `🔨 Tu as été **banni**.\n> Raison : ${reason}`);

  const extra = purge > 0 ? { '🧹 Messages purgés': `${purge} jour(s)` } : undefined;
  const { embed } = await finalizeSanction(interaction, { action: 'BAN', target, reason, extra });
  await interaction.reply({ embeds: [embed] });
}
