import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { runSanctionGuards, notifyTarget, finalizeSanction } from '../../utils/sanctions.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Retirer le mute d\'un utilisateur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à démute').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison (optionnelle)').setRequired(false));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason') || 'Aucune raison';

  const guard = await runSanctionGuards(interaction, target, 'moderatable');
  if (!guard.ok) return;

  if (!guard.member.communicationDisabledUntil) {
    return interaction.reply({ content: `❌ **${target.tag}** n'est pas mute.`, ephemeral: true });
  }

  await guard.member.timeout(null, reason);
  notifyTarget(target, interaction.guild.name, `🔊 Ton mute a été **retiré**.\n> Raison : ${reason}`);

  const { embed } = await finalizeSanction(interaction, { action: 'UNMUTE', target, reason });
  await interaction.reply({ embeds: [embed] });
}
