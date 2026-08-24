import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import {
  getCasesForUser, getAllCases, removeCase, addNoteToCase, getCase,
} from '../../database/repositories/CaseRepository.js';
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
    .setDescription('Supprimer un cas (Manage Server + raison obligatoire).')
    .addStringOption(o => o
      .setName('id')
      .setDescription('ID du cas (autocomplete)')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(o => o
      .setName('reason')
      .setDescription('Motif de la suppression (audit)')
      .setRequired(true)
      .setMaxLength(300)))
  .addSubcommand(s => s
    .setName('note')
    .setDescription('Ajouter une note staff à un cas.')
    .addStringOption(o => o
      .setName('id')
      .setDescription('ID du cas (autocomplete)')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(o => o
      .setName('text')
      .setDescription('Contenu de la note')
      .setRequired(true)
      .setMaxLength(500)));

export async function autocomplete(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub !== 'remove' && sub !== 'note') return interaction.respond([]);
  const focused = interaction.options.getFocused()?.toString().toUpperCase() ?? '';
  const list = getAllCases(interaction.guild.id, { limit: 25 });
  const matches = list
    .filter(c => !focused || c.case_id.includes(focused) || c.type.includes(focused))
    .slice(0, 25)
    .map(c => ({
      name:  `${c.case_id} · ${c.type} · <@${c.user_id}>`.replace(/<@|>/g, '').slice(0, 100),
      value: c.case_id,
    }));
  await interaction.respond(matches);
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'view')   return viewCase(interaction);
  if (sub === 'list')   return listCases(interaction);
  if (sub === 'remove') return removeCaseCmd(interaction);
  if (sub === 'note')   return noteCaseCmd(interaction);
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
      const exp   = c.expires_at ? ` · Exp: <t:${c.expires_at}:R>` : '';
      const notes = c.notes ? `\n📝 ${c.notes.split('\n').length} note(s)` : '';
      embed.addFields({
        name:  `\`${c.case_id}\` — ${c.type}${exp}`,
        value: `${c.reason}\n— <@${c.moderator_id}> · <t:${c.created_at}:F>${notes}`,
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
    embed.setFooter({ text: 'Détail par membre : /case view user:<@membre>' });
    return embed;
  }, { perPage: 5, ephemeral: true });
}

async function removeCaseCmd(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ embeds: [errorEmbed('La suppression d\'un cas nécessite Manage Server.')], ephemeral: true });
  }

  const caseId  = interaction.options.getString('id', true).toUpperCase().trim();
  const reason  = interaction.options.getString('reason', true);
  const removed = removeCase(interaction.guild.id, caseId);

  if (!removed) {
    return interaction.reply({ embeds: [errorEmbed(`Aucun cas \`${caseId}\` trouvé.`)], ephemeral: true });
  }

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'CASE_REMOVED', channel: null, moderator: interaction.user,
    reason,
    extra: {
      '🗑️ Casier':      `\`${caseId}\``,
      '👤 Concernait':   `<@${removed.user_id}>`,
      '📋 Type':          removed.type,
      '📝 Motif retrait': reason,
    },
  });

  await interaction.reply({
    embeds: [successEmbed(`Cas \`${caseId}\` (${removed.type}) supprimé — motif : ${reason}`)],
    ephemeral: true,
  });
}

async function noteCaseCmd(interaction) {
  const caseId = interaction.options.getString('id', true).toUpperCase().trim();
  const text   = interaction.options.getString('text', true);

  const updated = addNoteToCase(interaction.guild.id, caseId, text, interaction.user.id);
  if (!updated) {
    return interaction.reply({ embeds: [errorEmbed(`Aucun cas \`${caseId}\` trouvé.`)], ephemeral: true });
  }

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'CASE_NOTE', channel: null, moderator: interaction.user,
    reason: text.slice(0, 200),
    extra: { '📝 Casier': `\`${caseId}\``, '👤 Concerne': `<@${updated.user_id}>` },
  });

  await interaction.reply({
    embeds: [successEmbed(`Note ajoutée au cas \`${caseId}\`.`)],
    ephemeral: true,
  });
}
