import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getCasesForUser, getAllCases, removeCase } from '../../database/repositories/CaseRepository.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { logChannelAction } from '../../features/modlogs.js';

export const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('Gestion du casier disciplinaire.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
  .addSubcommand(s => s
    .setName('view')
    .setDescription('Afficher le casier d\'un utilisateur.')
    .addUserOption(o => o.setName('user').setDescription('Utilisateur à consulter').setRequired(true)))
  .addSubcommand(s => s
    .setName('list')
    .setDescription('Lister les cas du serveur (récents en premier).'))
  .addSubcommand(s => s
    .setName('remove')
    .setDescription('Supprimer un cas (Manage Server requis).')
    .addStringOption(o => o
      .setName('id')
      .setDescription('ID du cas (ex : GRC-20260821-00001)')
      .setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'view')   return viewCase(interaction);
  if (sub === 'list')   return listCases(interaction);
  if (sub === 'remove') return removeCaseCmd(interaction);
}

async function viewCase(interaction) {
  const target = interaction.options.getUser('user', true);
  const cases  = getCasesForUser(interaction.guild.id, target.id);

  if (!cases.length) {
    return interaction.reply({
      embeds: [successEmbed(`**${target.tag}** n'a aucun cas enregistré.`)],
      ephemeral: true,
    });
  }

  await sendPaginated(interaction, cases, (slice) => {
    const embed = new EmbedBuilder()
      .setTitle(`📋 Casier de ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setColor(COLORS.INFO)
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

async function listCases(interaction) {
  const list = getAllCases(interaction.guild.id);
  if (!list.length) {
    return interaction.reply({
      embeds: [successEmbed('Aucun cas enregistré sur ce serveur.')],
      ephemeral: true,
    });
  }

  await sendPaginated(interaction, list, (slice, page, total) => {
    const embed = new EmbedBuilder()
      .setTitle('📋 Cas disciplinaires du serveur')
      .setColor(COLORS.INFO)
      .setDescription(`**${list.length}** cas — page ${page}/${total}.`);

    for (const c of slice) {
      embed.addFields({
        name:  `\`${c.case_id}\` — ${c.type}`,
        value: `<@${c.user_id}> · ${c.reason}\n— <@${c.moderator_id}> · <t:${c.created_at}:R>`,
      });
    }
    embed.setFooter({ text: 'Détail par membre : /case view @user' });
    return embed;
  }, { perPage: 5, ephemeral: true });
}

async function removeCaseCmd(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ embeds: [errorEmbed('La suppression d\'un cas nécessite Manage Server.')], ephemeral: true });
  }

  const caseId  = interaction.options.getString('id', true).toUpperCase().trim();
  const removed = removeCase(interaction.guild.id, caseId);

  if (!removed) {
    return interaction.reply({ embeds: [errorEmbed(`Aucun cas \`${caseId}\` trouvé.`)], ephemeral: true });
  }

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'CASE_REMOVED', channel: null, moderator: interaction.user,
    reason: `Cas ${caseId} supprimé (${removed.type} sur <@${removed.user_id}>)`,
    extra: { '🗑️ Casier': `\`${caseId}\``, '👤 Concernait': `<@${removed.user_id}>` },
  });

  await interaction.reply({
    embeds: [successEmbed(`Cas \`${caseId}\` (${removed.type}) supprimé.`)],
    ephemeral: true,
  });
}
