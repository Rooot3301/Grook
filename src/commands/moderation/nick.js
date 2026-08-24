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

  // Anti-self : pas de sens
  if (target.id === interaction.client.user.id) {
    return interaction.reply({ embeds: [errorEmbed('Je ne peux pas changer mon propre pseudo via cette commande.')], ephemeral: true });
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.reply({ embeds: [errorEmbed('Utilisateur introuvable.')], ephemeral: true });

  // Faisabilité côté bot
  if (!member.manageable) {
    return interaction.reply({ embeds: [errorEmbed('Je ne peux pas modifier ce pseudo (rôle égal ou supérieur au mien).')], ephemeral: true });
  }

  // Hiérarchie modo/cible — sans ça un modo pourrait renommer un admin plus haut placé.
  // Exception : la personne se renomme elle-même (autorisé).
  const isSelf = target.id === interaction.user.id;
  if (!isSelf && member.roles.highest.position >= interaction.member.roles.highest.position) {
    return interaction.reply({ embeds: [errorEmbed('Cet utilisateur a un rôle égal ou supérieur au tien.')], ephemeral: true });
  }
  // Protection du owner : jamais renommable par une commande.
  if (target.id === interaction.guild.ownerId) {
    return interaction.reply({ embeds: [errorEmbed('Le propriétaire du serveur ne peut pas être renommé via une commande.')], ephemeral: true });
  }

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
