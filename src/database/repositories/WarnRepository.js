import db from '../index.js';

/**
 * Crée un avertissement.
 * @param {{ guildId, userId, reason, moderatorId }} params
 */
export function createWarn({ guildId, userId, reason, moderatorId }) {
  const result = db.prepare(
    'INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)'
  ).run(guildId, userId, moderatorId, reason || 'Aucune raison');
  return db.prepare('SELECT * FROM warnings WHERE id = ?').get(result.lastInsertRowid);
}

/** Récupère tous les avertissements d'un utilisateur sur un serveur. */
export function getWarnsForUser(guildId, userId) {
  return db.prepare(
    'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC'
  ).all(guildId, userId);
}
