import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getWarnsForUser } from '../../database/repositories/WarnRepository.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('warnings')
  .setDescription('Afficher les avertissements d\'un membre.')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption(o => o.setName('user').setDescription('Membre ciblé').setRequired(true));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const warns  = getWarnsForUser(interaction.guild.id, target.id);

  if (!warns.length) {
    return interaction.reply({ content: `✅ **${target.tag}** n'a aucun avertissement.`, ephemeral: true });
  }

  await sendPaginated(interaction, warns, (slice, page, total) => {
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Avertissements de ${target.tag}`)
      .setColor(COLORS.WARN)
      .setDescription(`**${warns.length}** avertissement(s) au total.`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    for (const [i, w] of slice.entries()) {
      const num = (page - 1) * 5 + i + 1;
      embed.addFields({
        name: `#${num} — <t:${w.created_at}:D>`,
        value: `${w.reason}\n— <@${w.moderator_id}>`,
      });
    }
    return embed;
  }, { perPage: 5, ephemeral: true });
}
