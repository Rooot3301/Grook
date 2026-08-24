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
    'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC'
  ).all(guildId, userId);
}

/** Récupère les avertissements d'un serveur (récents en premier), paginé. */
export function getWarnsForGuild(guildId, { limit = 200, offset = 0 } = {}) {
  return db.prepare(
    'SELECT * FROM warnings WHERE guild_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
  ).all(guildId, limit, offset);
}

export function countWarnings(guildId) {
  return db.prepare('SELECT COUNT(*) AS c FROM warnings WHERE guild_id = ?').get(guildId).c;
}

/** Supprime TOUS les warns d'un utilisateur sur une guild. Retourne le nombre supprimé. */
export function clearWarnsForUser(guildId, userId) {
  const info = db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  return info.changes;
}

/** Supprime un avertissement par ID (sans vérification de guild). */
export function removeWarn(id) {
  const row = db.prepare('SELECT * FROM warnings WHERE id = ?').get(id);
  if (!row) return null;
  db.prepare('DELETE FROM warnings WHERE id = ?').run(id);
  return row;
}

/**
 * Supprime un warn seulement s'il appartient à la guild donnée.
 * Retourne :
 *   - null            : warn introuvable
 *   - { wrongGuild }  : warn existe mais dans une autre guild → PAS supprimé
 *   - la row          : suppression effectuée
 */
export function removeWarnIfInGuild(id, guildId) {
  const row = db.prepare('SELECT * FROM warnings WHERE id = ?').get(id);
  if (!row) return null;
  if (row.guild_id !== guildId) return { wrongGuild: true, row };
  db.prepare('DELETE FROM warnings WHERE id = ?').run(id);
  return row;
}
