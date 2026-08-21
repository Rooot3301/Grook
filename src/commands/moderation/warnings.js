import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getWarnsForUser } from '../../database/repositories/WarnRepository.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS, successEmbed } from '../../utils/embeds.js';

const PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('Afficher les avertissements d\'un membre.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName('user').setDescription('Membre ciblé').setRequired(true));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const warns  = getWarnsForUser(interaction.guild.id, target.id);

  if (!warns.length) {
    return interaction.reply({
      embeds: [successEmbed(`**${target.tag}** n'a aucun avertissement.`)],
      ephemeral: true,
    });
  }

  await sendPaginated(interaction, warns, (slice, page) => {
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Avertissements de ${target.tag}`)
      .setColor(COLORS.WARN)
      .setDescription(`**${warns.length}** avertissement(s) au total.`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    for (const [i, w] of slice.entries()) {
      const num = (page - 1) * PER_PAGE + i + 1;
      embed.addFields({
        name:  `#${num} — <t:${w.created_at}:D>`,
        value: `${w.reason}\n— <@${w.moderator_id}>`,
      });
    }
    return embed;
  }, { perPage: PER_PAGE, ephemeral: true });
}
