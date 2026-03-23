import { EmbedBuilder } from 'discord.js';

// ─── Palette de couleurs ────────────────────────────────────────────────────
export const COLORS = {
  SUCCESS:  0x57F287,   // vert Discord
  ERROR:    0xED4245,   // rouge Discord
  WARNING:  0xFEE75C,   // jaune Discord
  INFO:     0x5865F2,   // blurple Discord
  NEUTRAL:  0x99AAB5,   // gris
  BAN:      0xFF2222,
  KICK:     0xFF6622,
  MUTE:     0xFFAA00,
  UNMUTE:   0x57F287,
  WARN:     0xFEE75C,
  UNBAN:    0x57F287,
  TEMPBAN:  0xFF4444,
  SOFTBAN:  0xFF8844,
  GAME:     0x9B59B6,
  FUN:      0x3498DB,
};

// ─── Helpers génériques ──────────────────────────────────────────────────────

/** Embed de succès (description verte). */
export function successEmbed(message) {
  return new EmbedBuilder()
    .setDescription(`✅ ${message}`)
    .setColor(COLORS.SUCCESS)
    .setTimestamp();
}

/** Embed d'erreur (description rouge). */
export function errorEmbed(message) {
  return new EmbedBuilder()
    .setDescription(`❌ ${message}`)
    .setColor(COLORS.ERROR)
    .setTimestamp();
}

/** Embed neutre avec titre. */
export function infoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description ?? null)
    .setColor(COLORS.INFO)
    .setTimestamp();
}

// ─── Embed de modération ─────────────────────────────────────────────────────

const ACTION_META = {
  BAN:     { color: COLORS.BAN,     emoji: '🔨', label: 'Banni'    },
  KICK:    { color: COLORS.KICK,    emoji: '👢', label: 'Expulsé'  },
  MUTE:    { color: COLORS.MUTE,    emoji: '🔇', label: 'Mute'     },
  UNMUTE:  { color: COLORS.UNMUTE,  emoji: '🔊', label: 'Démute'   },
  WARN:    { color: COLORS.WARN,    emoji: '⚠️', label: 'Averti'   },
  UNBAN:   { color: COLORS.UNBAN,   emoji: '🔓', label: 'Débanni'  },
  TEMPBAN: { color: COLORS.TEMPBAN, emoji: '⏳', label: 'Temp-ban' },
  SOFTBAN: { color: COLORS.SOFTBAN, emoji: '🧹', label: 'Soft-ban' },
};

/**
 * Construit un embed de confirmation de sanction (pour la réponse dans le salon).
 *
 * @param {{ action, target, moderator, reason, caseId?, extra? }} opts
 */
export function moderationEmbed({ action, target, moderator, reason, caseId, extra = {} }) {
  const meta = ACTION_META[action] ?? { color: COLORS.INFO, emoji: '📋', label: action };

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setAuthor({
      name:    `${meta.emoji} ${meta.label}`,
      iconURL: target.displayAvatarURL?.({ dynamic: true }),
    })
    .setThumbnail(target.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      { name: '👤 Utilisateur',  value: `${target.tag}\n<@${target.id}>`,   inline: true },
      { name: '🛡️ Modérateur',   value: `${moderator.tag}\n<@${moderator.id}>`, inline: true },
      { name: '\u200B',           value: '\u200B',                            inline: true },
      { name: '📝 Raison',        value: reason || 'Aucune raison',           inline: false },
    )
    .setTimestamp();

  if (caseId) embed.setFooter({ text: `Cas ${caseId}` });

  for (const [name, value] of Object.entries(extra)) {
    embed.addFields({ name, value: String(value), inline: true });
  }

  return embed;
}

/**
 * Construit l'embed de log envoyé dans le salon modlogs (plus détaillé).
 * Distinct de moderationEmbed pour pouvoir afficher les avatars / timestamps.
 */
export function modlogEmbed({ action, target, moderator, reason, caseId, extra = {} }) {
  const meta = ACTION_META[action] ?? { color: COLORS.INFO, emoji: '📋', label: action };

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.emoji} ${action}${caseId ? ` — \`${caseId}\`` : ''}`)
    .setThumbnail(target.displayAvatarURL?.({ dynamic: true }) ?? null)
    .addFields(
      { name: '👤 Utilisateur',  value: `<@${target.id}>\n\`${target.tag}\``,     inline: true },
      { name: '🛡️ Modérateur',   value: `<@${moderator.id}>\n\`${moderator.tag}\``, inline: true },
      { name: '\u200B',           value: '\u200B',                                  inline: true },
      { name: '📝 Raison',        value: reason || 'Aucune raison',                 inline: false },
    )
    .setTimestamp();

  for (const [name, value] of Object.entries(extra)) {
    embed.addFields({ name, value: String(value), inline: true });
  }

  return embed;
}
