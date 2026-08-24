import { SlashCommandBuilder } from 'discord.js';
import { setAfk, removeAfk, getAfk } from '../../database/repositories/AfkRepository.js';
import { successEmbed, infoEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Définit, met à jour ou retire ton statut AFK.')
  .addStringOption(o => o
    .setName('raison')
    .setDescription('Raison AFK — fournir une raison quand déjà AFK MET À JOUR, sans arg = retire l\'AFK')
    .setMaxLength(200));

export async function execute(interaction) {
  const raison   = interaction.options.getString('raison');
  const existing = getAfk(interaction.user.id, interaction.guildId);

  // Retirer l'AFK : soit /afk sans arg, soit ré-exécuter /afk même raison peu importe.
  // Convention retenue :
  //   déjà AFK + PAS de raison    → retire
  //   déjà AFK + raison            → met à jour la raison (RESTE AFK)
  //   pas AFK                      → active avec raison (défaut 'AFK')
  if (existing && !raison) {
    removeAfk(interaction.user.id, interaction.guildId);
    return interaction.reply({
      embeds: [successEmbed(`Bienvenue de retour **${interaction.user.displayName}** ! Ton statut AFK a été retiré.`)],
      ephemeral: true,
    });
  }

  const effectiveReason = raison || 'AFK';
  setAfk(interaction.user.id, interaction.guildId, effectiveReason);

  const title       = existing ? '💤 AFK mis à jour' : '💤 AFK activé';
  const description = existing
    ? `**${interaction.user.displayName}** — nouvelle raison : ${effectiveReason}`
    : `**${interaction.user.displayName}** est maintenant AFK.\n> ${effectiveReason}`;

  await interaction.reply({
    embeds: [infoEmbed(title, description)],
    ephemeral: true,
  });
}
