import db from '../index.js';

const DEFAULTS = {
  enabled:            0,
  warn_mute_at:       null,
  warn_mute_duration: null,
  warn_kick_at:       null,
  warn_ban_at:        null,
};

/**
 * Retourne la config automod d'un serveur (défauts si aucune).
 * L'automod est DÉSACTIVÉ par défaut — aucune escalade n'a lieu tant que
 * `enabled = 1` et au moins un seuil n'a pas été défini via /config.
 */
export function getAutomodConfig(guildId) {
  const row = db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
  return { ...DEFAULTS, guild_id: guildId, ...(row || {}) };
}

export function setAutomodConfig(guildId, updates) {
  db.prepare('INSERT OR IGNORE INTO automod_config (guild_id) VALUES (?)').run(guildId);
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`
    UPDATE automod_config SET ${fields}, updated_at = unixepoch() WHERE guild_id = @guild_id
  `).run({ ...updates, guild_id: guildId });
  return getAutomodConfig(guildId);
}

export function resetAutomodConfig(guildId) {
  db.prepare(`
    UPDATE automod_config
    SET enabled = 0,
        warn_mute_at = NULL,
        warn_mute_duration = NULL,
        warn_kick_at = NULL,
        warn_ban_at = NULL,
        updated_at = unixepoch()
    WHERE guild_id = ?
  `).run(guildId);
  return getAutomodConfig(guildId);
}
