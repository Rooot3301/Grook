import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('nick')
  .setDescription('Changer (ou réinitialiser) le pseudo d\'un membre.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur ciblé').setRequired(true))
  .addStringOption(o => o
    .setName('pseudo')
    .setDescription('Nouveau pseudo (max 32 caractères, vide pour réinitialiser)')
    .setMaxLength(32));

export async function execute(interaction) {
  const target  = interaction.options.getUser('user', true);
  const newNick = interaction.options.getString('pseudo')?.trim() || null;
  const member  = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ embeds: [errorEmbed('Utilisateur introuvable.')], ephemeral: true });
  if (!member.manageable) return interaction.reply({ embeds: [errorEmbed('Je ne peux pas modifier le pseudo de cet utilisateur.')], ephemeral: true });

  const before = member.displayName;
  try {
    await member.setNickname(newNick);
  } catch {
    return interaction.reply({ embeds: [errorEmbed('Impossible de changer ce pseudo.')], ephemeral: true });
  }

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'NICK', channel: null, moderator: interaction.user,
    reason: newNick ? `Pseudo → **${newNick}**` : 'Pseudo réinitialisé',
    extra: {
      '👤 Cible':  `<@${target.id}>`,
      '⬅️ Avant': before,
      '➡️ Après': newNick ?? '*(réinitialisé)*',
    },
  });

  const msg = newNick
    ? `Pseudo de <@${target.id}> changé en **${newNick}**.`
    : `Pseudo de <@${target.id}> réinitialisé.`;
  await interaction.reply({ embeds: [successEmbed(msg)], allowedMentions: { users: [] } });
}
