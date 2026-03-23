import db from '../index.js';

function generateCaseId(guildId) {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM cases WHERE guild_id = ?').get(guildId);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `GRC-${date}-${String(c + 1).padStart(5, '0')}`;
}

/**
 * Crée un nouveau cas disciplinaire.
 * @param {{ guildId, userId, type, reason, moderatorId, expiresAt? }} params
 */
export function createCase({ guildId, userId, type, reason, moderatorId, expiresAt = null }) {
  const caseId = generateCaseId(guildId);
  const expiresAtUnix = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null;
  db.prepare(
    'INSERT INTO cases (case_id, guild_id, type, user_id, moderator_id, reason, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(caseId, guildId, type, userId, moderatorId, reason || 'Aucune raison', expiresAtUnix);
  return db.prepare('SELECT * FROM cases WHERE guild_id = ? AND case_id = ?').get(guildId, caseId);
}

/** Récupère tous les cas d'un utilisateur sur un serveur. */
export function getCasesForUser(guildId, userId) {
  return db.prepare(
    'SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC'
  ).all(guildId, userId);
}

/** Récupère tous les cas d'un serveur (les plus récents en premier). */
export function getAllCases(guildId) {
  return db.prepare(
    'SELECT * FROM cases WHERE guild_id = ? ORDER BY created_at DESC'
  ).all(guildId);
}

/** Supprime un cas. Retourne le cas supprimé ou null. */
export function removeCase(guildId, caseId) {
  const existing = db.prepare('SELECT * FROM cases WHERE guild_id = ? AND case_id = ?').get(guildId, caseId);
  if (!existing) return null;
  db.prepare('DELETE FROM cases WHERE guild_id = ? AND case_id = ?').run(guildId, caseId);
  return existing;
}
