import { SlashCommandBuilder } from 'discord.js';
import { setAfk, removeAfk, getAfk } from '../../database/repositories/AfkRepository.js';
import { successEmbed, infoEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Définit ou retire ton statut AFK.')
  .addStringOption(o => o
    .setName('raison')
    .setDescription('Raison de ton absence (optionnel)')
    .setMaxLength(200));

export async function execute(interaction) {
  const existing = getAfk(interaction.user.id, interaction.guildId);

  if (existing) {
    removeAfk(interaction.user.id, interaction.guildId);
    return interaction.reply({
      embeds: [successEmbed(`Bienvenue de retour **${interaction.user.displayName}** ! Ton statut AFK a été retiré.`)],
      ephemeral: true,
    });
  }

  const raison = interaction.options.getString('raison') || 'AFK';
  setAfk(interaction.user.id, interaction.guildId, raison);

  await interaction.reply({
    embeds: [infoEmbed('💤 AFK activé', `**${interaction.user.displayName}** est maintenant AFK.\n> ${raison}`)],
    ephemeral: true,
  });
}
