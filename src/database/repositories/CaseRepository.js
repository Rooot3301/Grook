import db from '../index.js';

const insertCounter = db.prepare('INSERT OR IGNORE INTO guild_counters (guild_id, next_case) VALUES (?, 1)');
const getAndBumpSeq = db.prepare(`
  UPDATE guild_counters
  SET next_case = next_case + 1
  WHERE guild_id = ?
  RETURNING next_case - 1 AS seq
`);
const insertCase = db.prepare(`
  INSERT INTO cases (case_id, guild_id, guild_seq, type, user_id, moderator_id, reason, expires_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

/**
 * Crée un cas disciplinaire.
 *
 * Génération atomique du case_id via une table de compteurs par guild
 * (transaction serialisée) — pas de collision possible même sous charge.
 *
 * @param {{ guildId, userId, type, reason, moderatorId, expiresAt? }} params
 */
export const createCase = db.transaction(({ guildId, userId, type, reason, moderatorId, expiresAt = null }) => {
  insertCounter.run(guildId);
  const { seq } = getAndBumpSeq.get(guildId);
  const date    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const caseId  = `GRC-${date}-${String(seq).padStart(5, '0')}`;
  const expUnix = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : null;

  insertCase.run(caseId, guildId, seq, type, userId, moderatorId, reason || 'Aucune raison', expUnix);
  return db.prepare('SELECT * FROM cases WHERE guild_id = ? AND case_id = ?').get(guildId, caseId);
});

// `created_at` a une résolution d'1 seconde — on trie aussi par id DESC pour
// garantir un ordre déterministe même sous inserts très rapprochés.
const ORDER_RECENT = 'ORDER BY created_at DESC, id DESC';

/** Récupère tous les cas d'un utilisateur sur un serveur. */
export function getCasesForUser(guildId, userId) {
  return db.prepare(
    `SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ${ORDER_RECENT}`
  ).all(guildId, userId);
}

/** Récupère les cas d'un serveur (récents en premier), paginé. */
export function getAllCases(guildId, { limit = 200, offset = 0 } = {}) {
  return db.prepare(
    `SELECT * FROM cases WHERE guild_id = ? ${ORDER_RECENT} LIMIT ? OFFSET ?`
  ).all(guildId, limit, offset);
}

/** Nombre total de cas pour un serveur (pour la pagination). */
export function countCases(guildId) {
  return db.prepare('SELECT COUNT(*) AS c FROM cases WHERE guild_id = ?').get(guildId).c;
}

/** Récupère un cas par son ID. */
export function getCase(guildId, caseId) {
  return db.prepare('SELECT * FROM cases WHERE guild_id = ? AND case_id = ?').get(guildId, caseId);
}

/** Supprime un cas. Retourne le cas supprimé ou null. */
export function removeCase(guildId, caseId) {
  const existing = getCase(guildId, caseId);
  if (!existing) return null;
  db.prepare('DELETE FROM cases WHERE guild_id = ? AND case_id = ?').run(guildId, caseId);
  return existing;
}

/**
 * Ajoute une note staff à un cas. Stocké en JSON-lines dans la colonne `notes`.
 * Chaque ligne = { by, at, text }. Retourne le cas mis à jour ou null.
 */
export function addNoteToCase(guildId, caseId, noteText, moderatorId) {
  const existing = getCase(guildId, caseId);
  if (!existing) return null;
  const entry = JSON.stringify({ by: moderatorId, at: Math.floor(Date.now() / 1000), text: noteText });
  const nextNotes = existing.notes ? existing.notes + '\n' + entry : entry;
  db.prepare('UPDATE cases SET notes = ? WHERE guild_id = ? AND case_id = ?').run(nextNotes, guildId, caseId);
  return getCase(guildId, caseId);
}
