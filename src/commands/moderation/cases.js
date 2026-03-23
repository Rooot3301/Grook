import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getAllCases } from '../../database/repositories/CaseRepository.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('cases')
  .setDescription('Lister les derniers cas disciplinaires du serveur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog);

export async function execute(interaction) {
  const list = getAllCases(interaction.guild.id);

  if (!list.length) {
    return interaction.reply({ content: '✅ Aucun cas enregistré sur ce serveur.', ephemeral: true });
  }

  await sendPaginated(interaction, list, (slice, page, total) => {
    const embed = new EmbedBuilder()
      .setTitle('📋 Cas disciplinaires du serveur')
      .setColor(COLORS.ERROR)
      .setDescription(`**${list.length}** cas au total — page ${page}/${total}.`);

    for (const c of slice) {
      embed.addFields({
        name:  `\`${c.case_id}\` — ${c.type}`,
        value: `<@${c.user_id}> · ${c.reason}\n— <@${c.moderator_id}> · <t:${c.created_at}:R>`,
      });
    }
    embed.setFooter({ text: 'Détail par membre : /case @user' });
    return embed;
  }, { perPage: 5, ephemeral: true });
}
