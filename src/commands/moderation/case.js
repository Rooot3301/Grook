import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getCasesForUser } from '../../database/repositories/CaseRepository.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('Afficher le casier disciplinaire d\'un utilisateur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à consulter').setRequired(true));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const cases  = getCasesForUser(interaction.guild.id, target.id);

  if (!cases.length) {
    return interaction.reply({ content: `✅ **${target.tag}** n'a aucun cas enregistré.`, ephemeral: true });
  }

  await sendPaginated(interaction, cases, (slice, page, total) => {
    const embed = new EmbedBuilder()
      .setTitle(`📋 Casier de ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setColor(COLORS.ERROR)
      .setDescription(`**${cases.length}** cas enregistré(s).`);

    for (const c of slice) {
      const exp = c.expires_at ? ` · Exp: <t:${c.expires_at}:R>` : '';
      embed.addFields({
        name:  `\`${c.case_id}\` — ${c.type}${exp}`,
        value: `${c.reason}\n— <@${c.moderator_id}> · <t:${c.created_at}:F>`,
      });
    }
    return embed;
  }, { perPage: 5, ephemeral: true });
}
