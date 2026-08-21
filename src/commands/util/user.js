import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getWarnsForUser } from '../../database/repositories/WarnRepository.js';
import { getCasesForUser } from '../../database/repositories/CaseRepository.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS, successEmbed, errorEmbed } from '../../utils/embeds.js';

const MAX_ROLES_SHOWN = 15;

export const data = new SlashCommandBuilder()
  .setName('user')
  .setDescription('Fiche d\'un utilisateur — infos, avatar, avertissements, casier.')
  .addSubcommand(s => s
    .setName('info')
    .setDescription('Informations générales d\'un utilisateur (accepte un ID hors serveur).')
    .addStringOption(o => o.setName('cible').setDescription('Utilisateur (mention ou ID)').setRequired(true)))
  .addSubcommand(s => s
    .setName('avatar')
    .setDescription('Avatar HD d\'un utilisateur.')
    .addUserOption(o => o.setName('user').setDescription('Utilisateur (toi si vide)').setRequired(false)))
  .addSubcommand(s => s
    .setName('warnings')
    .setDescription('Liste des avertissements d\'un membre.')
    .addUserOption(o => o.setName('user').setDescription('Membre').setRequired(true)))
  .addSubcommand(s => s
    .setName('cases')
    .setDescription('Casier disciplinaire d\'un membre.')
    .addUserOption(o => o.setName('user').setDescription('Membre').setRequired(true)));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'info')     return userInfo(interaction);
  if (sub === 'avatar')   return userAvatar(interaction);
  if (sub === 'warnings') return userWarnings(interaction);
  if (sub === 'cases')    return userCases(interaction);
}

async function userInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const raw = interaction.options.getString('cible').replace(/[<@!>]/g, '').trim();
  if (!/^\d{17,20}$/.test(raw)) {
    return interaction.editReply({ embeds: [errorEmbed('ID Discord invalide. Fournis une mention ou un ID numérique.')] });
  }

  let user;
  try { user = await interaction.client.users.fetch(raw, { force: true }); }
  catch { return interaction.editReply({ embeds: [errorEmbed(`Aucun utilisateur trouvé avec l'ID \`${raw}\`.`)] }); }

  const member = await interaction.guild.members.fetch(raw).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor(member?.displayHexColor ?? COLORS.INFO)
    .setTitle(user.tag)
    .setThumbnail(user.displayAvatarURL({ size: 256, dynamic: true }))
    .addFields(
      { name: '🆔 ID',             value: user.id, inline: true },
      { name: '🤖 Bot',            value: user.bot ? 'Oui' : 'Non', inline: true },
      { name: '📅 Compte créé',    value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
    );

  if (member) {
    const allRoles = member.roles.cache.filter(r => r.id !== interaction.guild.id);
    const shown    = allRoles.first(MAX_ROLES_SHOWN).map(r => r.toString());
    const overflow = Math.max(0, allRoles.size - shown.length);
    embed.addFields(
      { name: '📥 Rejoint', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: `🎭 Rôles (${allRoles.size})`,
        value: shown.length ? shown.join(' ') + (overflow ? ` *+${overflow}*` : '') : 'Aucun',
        inline: false },
    );
    if (member.nickname) embed.addFields({ name: '✏️ Pseudo serveur', value: member.nickname, inline: true });
  } else {
    embed.setFooter({ text: 'Cet utilisateur n\'est pas dans ce serveur.' });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function userAvatar(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const global = target.displayAvatarURL({ size: 4096, extension: 'png' });
  const member = interaction.guild?.members.cache.get(target.id);
  const server = member?.displayAvatarURL({ size: 4096, extension: 'png' });

  const embed = new EmbedBuilder()
    .setTitle(`🖼️ Avatar de ${target.tag}`)
    .setColor(COLORS.INFO)
    .setImage(server ?? global)
    .setURL(server ?? global);

  await interaction.reply({ embeds: [embed] });
}

async function userWarnings(interaction) {
  const target = interaction.options.getUser('user', true);
  if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ embeds: [errorEmbed('La consultation des avertissements requiert Kick Members.')], ephemeral: true });
  }
  const warns = getWarnsForUser(interaction.guild.id, target.id);
  if (!warns.length) {
    return interaction.reply({ embeds: [successEmbed(`**${target.tag}** n'a aucun avertissement.`)], ephemeral: true });
  }
  await sendPaginated(interaction, warns, (slice, page) => {
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Avertissements de ${target.tag}`)
      .setColor(COLORS.WARN)
      .setDescription(`**${warns.length}** avertissement(s).`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));
    for (const [i, w] of slice.entries()) {
      embed.addFields({
        name:  `#${(page - 1) * 5 + i + 1} — <t:${w.created_at}:D>`,
        value: `${w.reason}\n— <@${w.moderator_id}>`,
      });
    }
    return embed;
  }, { perPage: 5, ephemeral: true });
}

async function userCases(interaction) {
  const target = interaction.options.getUser('user', true);
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ViewAuditLog)) {
    return interaction.reply({ embeds: [errorEmbed('La consultation du casier requiert View Audit Log.')], ephemeral: true });
  }
  const cases = getCasesForUser(interaction.guild.id, target.id);
  if (!cases.length) {
    return interaction.reply({ embeds: [successEmbed(`**${target.tag}** n'a aucun cas enregistré.`)], ephemeral: true });
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
