import db from '../index.js';

/** Incrémente les victoires d'un joueur à un jeu donné. */
export function incrementWin(guildId, userId, game) {
  db.prepare(`
    INSERT INTO game_stats (guild_id, user_id, game, wins)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(guild_id, user_id, game) DO UPDATE SET wins = wins + 1
  `).run(guildId, userId, game);
}

/**
 * Retourne les stats d'un utilisateur sur un serveur : { game: wins, ... }
 */
export function getStatsForUser(guildId, userId) {
  const rows = db.prepare(
    'SELECT * FROM game_stats WHERE guild_id = ? AND user_id = ? ORDER BY wins DESC'
  ).all(guildId, userId);
  const result = {};
  for (const row of rows) result[row.game] = row.wins;
  return result;
}

/**
 * Retourne les stats d'un serveur sous la forme :
 * { userId: { game: wins, ... }, ... }
 */
export function getStatsForGuild(guildId) {
  const rows = db.prepare(
    'SELECT * FROM game_stats WHERE guild_id = ? ORDER BY wins DESC'
  ).all(guildId);
  const result = {};
  for (const row of rows) {
    if (!result[row.user_id]) result[row.user_id] = {};
    result[row.user_id][row.game] = row.wins;
  }
  return result;
}
