import db from '../index.js';

const DEFAULTS = {
  modlogs_channel_id: null,
  welcome_channel_id: null,
  vt_scanner:         0,
  egg_rickroll:       1,
  egg_stare:          1,
  egg_fake_crash:     1,
  egg_keywords:       1,
  egg_nice:           1,
  egg_lazy:           1,
};

/**
 * Récupère la configuration d'un serveur.
 * Retourne les valeurs par défaut si le serveur n'est pas configuré.
 */
export function getGuildConfig(guildId) {
  const row = db.prepare('SELECT * FROM guild_configs WHERE guild_id = ?').get(guildId);
  return { ...DEFAULTS, guild_id: guildId, ...(row || {}) };
}

/**
 * Met à jour un ou plusieurs champs de la configuration d'un serveur.
 * Crée la ligne si elle n'existe pas.
 */
export function setGuildConfig(guildId, updates) {
  db.prepare('INSERT OR IGNORE INTO guild_configs (guild_id) VALUES (?)').run(guildId);
  const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE guild_configs SET ${fields}, updated_at = unixepoch() WHERE guild_id = @guild_id`)
    .run({ ...updates, guild_id: guildId });
}

/**
 * Initialise la configuration d'un serveur avec les valeurs par défaut (si inexistante).
 */
export function initGuildConfig(guildId) {
  db.prepare('INSERT OR IGNORE INTO guild_configs (guild_id) VALUES (?)').run(guildId);
}

/**
 * Remet la configuration d'un serveur aux valeurs par défaut.
 */
export function resetGuildConfig(guildId) {
  db.prepare(`
    UPDATE guild_configs
    SET modlogs_channel_id = NULL,
        welcome_channel_id = NULL,
        vt_scanner = 0,
        egg_rickroll = 1,
        egg_stare = 1,
        egg_fake_crash = 1,
        egg_keywords = 1,
        egg_nice = 1,
        egg_lazy = 1,
        updated_at = unixepoch()
    WHERE guild_id = ?
  `).run(guildId);
}
