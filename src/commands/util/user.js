import {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { getWarnsForUser } from '../../database/repositories/WarnRepository.js';
import { getCasesForUser } from '../../database/repositories/CaseRepository.js';
import { getTempBan }      from '../../database/repositories/TempBanRepository.js';
import { getAfk }          from '../../database/repositories/AfkRepository.js';
import { sendPaginated } from '../../utils/pagination.js';
import { COLORS, successEmbed, errorEmbed } from '../../utils/embeds.js';

const MAX_ROLES_SHOWN = 12;

export const data = new SlashCommandBuilder()
  .setName('user')
  .setDescription('Fiche d\'un utilisateur — profil aggrégé, avatar, avertissements, casier.')
  .addSubcommand(s => s
    .setName('info')
    .setDescription('Profil aggrégé : rôles, warns, cases, tempban, AFK.')
    .addUserOption(o => o.setName('user').setDescription('Membre (toi si vide)').setRequired(false)))
  .addSubcommand(s => s
    .setName('avatar')
    .setDescription('Avatar HD.')
    .addUserOption(o => o.setName('user').setDescription('Membre (toi si vide)').setRequired(false)))
  .addSubcommand(s => s
    .setName('warnings')
    .setDescription('Liste des avertissements.')
    .addUserOption(o => o.setName('user').setDescription('Membre').setRequired(true)))
  .addSubcommand(s => s
    .setName('cases')
    .setDescription('Casier disciplinaire.')
    .addUserOption(o => o.setName('user').setDescription('Membre').setRequired(true)));

export async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'info')     return userInfo(interaction, client);
  if (sub === 'avatar')   return userAvatar(interaction);
  if (sub === 'warnings') return userWarnings(interaction);
  if (sub === 'cases')    return userCases(interaction);
}

// ─── Fiche riche aggrégée + boutons ──────────────────────────────────────────
async function userInfo(interaction, client) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  const gid    = interaction.guild.id;

  // Les infos modération (warns, cases, tempban actif, mute actif) sont
  // sensibles — on ne les affiche que si l'appelant a Kick Members
  // OU si la cible c'est lui-même.
  const isSelf     = target.id === interaction.user.id;
  const canSeeMod  = isSelf || interaction.memberPermissions.has(PermissionFlagsBits.KickMembers);

  const warns    = canSeeMod ? getWarnsForUser(gid, target.id) : [];
  const cases    = canSeeMod ? getCasesForUser(gid, target.id) : [];
  const tempban  = canSeeMod ? getTempBan(gid, target.id)      : null;
  const afk      = getAfk(target.id, gid); // AFK est publique

  const embed = new EmbedBuilder()
    .setColor(member?.displayHexColor ?? COLORS.INFO)
    .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ dynamic: true }) })
    .setThumbnail(target.displayAvatarURL({ size: 256, dynamic: true }))
    .addFields(
      { name: '🆔 ID',           value: `\`${target.id}\``, inline: true },
      { name: '📅 Compte créé',  value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '🤖 Bot',          value: target.bot ? 'Oui' : 'Non', inline: true },
    );

  if (member) {
    const allRoles = member.roles.cache.filter(r => r.id !== gid);
    const shown    = allRoles.first(MAX_ROLES_SHOWN).map(r => r.toString());
    const overflow = Math.max(0, allRoles.size - shown.length);
    embed.addFields(
      { name: '📥 Rejoint', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: '🎨 Couleur', value: member.displayHexColor === '#000000' ? '*(aucune)*' : member.displayHexColor, inline: true },
      { name: '💬 Pseudo',  value: member.nickname || '*(aucun)*', inline: true },
      { name: `🎭 Rôles (${allRoles.size})`,
        value: shown.length ? shown.join(' ') + (overflow ? ` *+${overflow}*` : '') : '*(aucun)*',
        inline: false },
    );
  } else {
    embed.setFooter({ text: 'Cet utilisateur n\'est pas dans ce serveur.' });
  }

  // ── Bloc de synthèse modération (visible uniquement si Kick Members) ─────
  if (canSeeMod) {
    const modLines = [];
    modLines.push(`⚠️ **Warns actifs** : \`${warns.length}\``);
    if (cases.length) {
      const latest = cases[0];
      modLines.push(`📋 **Casier** : \`${cases.length}\` cas — dernier \`${latest.type}\` <t:${latest.created_at}:R>`);
    } else {
      modLines.push('📋 **Casier** : vide');
    }
    if (tempban) {
      modLines.push(`⏳ **Temp-ban actif** — expire <t:${tempban.expires_at}:R>`);
    }
    if (member?.communicationDisabledUntil) {
      modLines.push(`🔇 **Mute actif** — expire <t:${Math.floor(member.communicationDisabledUntil.getTime() / 1000)}:R>`);
    }
    if (afk) {
      modLines.push(`💤 **AFK** — ${afk.reason} (depuis <t:${afk.set_at}:R>)`);
    }
    embed.addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', value: modLines.join('\n'), inline: false });
  } else if (afk) {
    // Sans les perms modo, on affiche seulement l'AFK (info publique).
    embed.addFields({ name: '💤 AFK', value: `${afk.reason} (depuis <t:${afk.set_at}:R>)`, inline: false });
  }

  // ── Boutons d'action rapide (uniquement si le user a les perms) ─────────
  const canModerate = interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)
                   || interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers);
  const components = [];

  if (canModerate) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ufi:w:${target.id}`).setLabel('Warnings').setEmoji('⚠️').setStyle(ButtonStyle.Secondary).setDisabled(!warns.length),
      new ButtonBuilder().setCustomId(`ufi:c:${target.id}`).setLabel('Casier').setEmoji('📋').setStyle(ButtonStyle.Secondary).setDisabled(!cases.length),
      new ButtonBuilder().setCustomId(`ufi:a:${target.id}`).setLabel('Avatar HD').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    );
    components.push(row1);
  }

  const reply = await interaction.reply({ embeds: [embed], components, ephemeral: true, fetchReply: true });
  if (!components.length) return;

  // ── Collector pour les boutons ──────────────────────────────────────────
  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith(`ufi:`),
    time: 5 * 60_000,
  });

  collector.on('collect', async (btn) => {
    const [, action, userId] = btn.customId.split(':');
    const u = await client.users.fetch(userId).catch(() => null);
    if (!u) return btn.reply({ content: '❌ Utilisateur introuvable.', ephemeral: true });

    if (action === 'w') {
      const list = getWarnsForUser(gid, u.id);
      return showWarnings(btn, u, list);
    }
    if (action === 'c') {
      const list = getCasesForUser(gid, u.id);
      return showCases(btn, u, list);
    }
    if (action === 'a') {
      const av = u.displayAvatarURL({ size: 4096, extension: 'png' });
      return btn.reply({
        embeds: [new EmbedBuilder().setTitle(`🖼️ Avatar de ${u.tag}`).setImage(av).setColor(COLORS.INFO).setURL(av)],
        ephemeral: true,
      });
    }
  });

  collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
}

// ─── Rendu paginé de la liste warns/cases via bouton (réutilise pagination) ─
async function showWarnings(btn, user, warns) {
  if (!warns.length) return btn.reply({ embeds: [successEmbed(`**${user.tag}** n'a aucun warn.`)], ephemeral: true });
  await sendPaginated(btn, warns, (slice, page) => {
    const e = new EmbedBuilder().setTitle(`⚠️ Warns de ${user.tag}`).setColor(COLORS.WARN)
      .setDescription(`**${warns.length}** avertissement(s).`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));
    for (const [i, w] of slice.entries()) {
      e.addFields({
        name:  `#${(page - 1) * 5 + i + 1} — <t:${w.created_at}:D>`,
        value: `${w.reason}\n— <@${w.moderator_id}>`,
      });
    }
    return e;
  }, { perPage: 5, ephemeral: true });
}

async function showCases(btn, user, cases) {
  if (!cases.length) return btn.reply({ embeds: [successEmbed(`**${user.tag}** n'a aucun cas.`)], ephemeral: true });
  await sendPaginated(btn, cases, (slice) => {
    const e = new EmbedBuilder().setTitle(`📋 Casier de ${user.tag}`).setColor(COLORS.INFO)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(`**${cases.length}** cas enregistré(s).`);
    for (const c of slice) {
      const exp = c.expires_at ? ` · Exp <t:${c.expires_at}:R>` : '';
      e.addFields({
        name:  `\`${c.case_id}\` — ${c.type}${exp}`,
        value: `${c.reason}\n— <@${c.moderator_id}> · <t:${c.created_at}:F>`,
      });
    }
    return e;
  }, { perPage: 5, ephemeral: true });
}

// ─── Avatar direct (subcommand simple) ──────────────────────────────────────
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

// ─── Warnings et cases (subcommands directes) ───────────────────────────────
async function userWarnings(interaction) {
  const target = interaction.options.getUser('user', true);
  if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ embeds: [errorEmbed('La consultation des avertissements nécessite Kick Members.')], ephemeral: true });
  }
  const warns = getWarnsForUser(interaction.guild.id, target.id);
  if (!warns.length) {
    return interaction.reply({ embeds: [successEmbed(`**${target.tag}** n'a aucun avertissement.`)], ephemeral: true });
  }
  await sendPaginated(interaction, warns, (slice, page) => {
    const e = new EmbedBuilder().setTitle(`⚠️ Warns de ${target.tag}`).setColor(COLORS.WARN)
      .setDescription(`**${warns.length}** avertissement(s).`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));
    for (const [i, w] of slice.entries()) {
      e.addFields({
        name:  `#${(page - 1) * 5 + i + 1} — <t:${w.created_at}:D>`,
        value: `${w.reason}\n— <@${w.moderator_id}>`,
      });
    }
    return e;
  }, { perPage: 5, ephemeral: true });
}

async function userCases(interaction) {
  const target = interaction.options.getUser('user', true);
  if (!interaction.memberPermissions.has(PermissionFlagsBits.ViewAuditLog)) {
    return interaction.reply({ embeds: [errorEmbed('La consultation du casier nécessite View Audit Log.')], ephemeral: true });
  }
  const cases = getCasesForUser(interaction.guild.id, target.id);
  if (!cases.length) {
    return interaction.reply({ embeds: [successEmbed(`**${target.tag}** n'a aucun cas enregistré.`)], ephemeral: true });
  }
  await sendPaginated(interaction, cases, (slice) => {
    const e = new EmbedBuilder().setTitle(`📋 Casier de ${target.tag}`).setColor(COLORS.INFO)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(`**${cases.length}** cas enregistré(s).`);
    for (const c of slice) {
      const exp = c.expires_at ? ` · Exp <t:${c.expires_at}:R>` : '';
      e.addFields({
        name:  `\`${c.case_id}\` — ${c.type}${exp}`,
        value: `${c.reason}\n— <@${c.moderator_id}> · <t:${c.created_at}:F>`,
      });
    }
    return e;
  }, { perPage: 5, ephemeral: true });
}
