import db from '../index.js';

export function setAfk(userId, guildId, reason = 'AFK') {
  db.prepare(`
    INSERT INTO afk_status (user_id, guild_id, reason)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, guild_id) DO UPDATE SET reason = excluded.reason, set_at = unixepoch()
  `).run(userId, guildId, reason);
}

export function removeAfk(userId, guildId) {
  db.prepare('DELETE FROM afk_status WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

export function getAfk(userId, guildId) {
  return db.prepare('SELECT * FROM afk_status WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}
