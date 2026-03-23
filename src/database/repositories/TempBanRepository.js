import db from '../index.js';

/**
 * Enregistre un temp-ban.
 */
export function createTempBan({ guildId, userId, moderatorId, reason, expiresAt }) {
  db.prepare(`
    INSERT OR REPLACE INTO temp_bans (guild_id, user_id, moderator_id, reason, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, userId, moderatorId, reason, Math.floor(expiresAt / 1000));
}

/**
 * Supprime le temp-ban d'un utilisateur (après unban ou expiration).
 */
export function removeTempBan(guildId, userId) {
  db.prepare('DELETE FROM temp_bans WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

/**
 * Retourne tous les temp-bans expirés (à débannir).
 */
export function getExpiredTempBans() {
  return db.prepare('SELECT * FROM temp_bans WHERE expires_at <= unixepoch()').all();
}

/**
 * Retourne le temp-ban actif d'un utilisateur sur un serveur (ou undefined).
 */
export function getTempBan(guildId, userId) {
  return db.prepare('SELECT * FROM temp_bans WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}
