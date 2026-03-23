import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('nick')
  .setDescription('Changer le pseudo d\'un membre.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur ciblé').setRequired(true))
  .addStringOption(o => o
    .setName('pseudo')
    .setDescription('Nouveau pseudo (max 32 caractères)')
    .setMaxLength(32)
    .setRequired(true));

export async function execute(interaction) {
  const target  = interaction.options.getUser('user', true);
  const newNick = interaction.options.getString('pseudo', true);
  const member  = await interaction.guild.members.fetch(target.id).catch(() => null);

  if (!member) return interaction.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });
  if (!member.manageable) return interaction.reply({ content: '❌ Je ne peux pas modifier le pseudo de cet utilisateur.', ephemeral: true });

  try {
    await member.setNickname(newNick);
    await interaction.reply({ content: `✅ Pseudo de <@${target.id}> changé en **${newNick}**.`, allowedMentions: { users: [] } });
  } catch {
    await interaction.reply({ content: '❌ Impossible de changer ce pseudo.', ephemeral: true });
  }
}
