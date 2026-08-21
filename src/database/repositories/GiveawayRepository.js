import db from '../index.js';

export function createGiveaway({ guildId, channelId, prize, hostId, endsAt }) {
  const result = db.prepare(`
    INSERT INTO giveaways (guild_id, channel_id, prize, host_id, ends_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, channelId, prize, hostId, Math.floor(endsAt / 1000));
  return db.prepare('SELECT * FROM giveaways WHERE id = ?').get(result.lastInsertRowid);
}

export function setGiveawayMessage(id, messageId) {
  db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(messageId, id);
}

export function endGiveaway(id, winnerId = null) {
  db.prepare('UPDATE giveaways SET ended = 1, winner_id = ? WHERE id = ?').run(winnerId, id);
}

export function getActiveGiveaways() {
  return db.prepare('SELECT * FROM giveaways WHERE ended = 0 ORDER BY ends_at ASC').all();
}

export function getGiveawayByMessage(messageId) {
  return db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
}

export function getGiveaway(id) {
  return db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
}

export function getGiveawaysForGuild(guildId, { includeEnded = true, limit = 50 } = {}) {
  if (includeEnded) {
    return db.prepare(
      'SELECT * FROM giveaways WHERE guild_id = ? ORDER BY ends_at DESC LIMIT ?'
    ).all(guildId, limit);
  }
  return db.prepare(
    'SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC LIMIT ?'
  ).all(guildId, limit);
}

// ─── Participants (persistés — survivent au restart) ─────────────────────────

export function addParticipant(giveawayId, userId) {
  db.prepare('INSERT OR IGNORE INTO giveaway_participants (giveaway_id, user_id) VALUES (?, ?)')
    .run(giveawayId, userId);
}

export function removeParticipant(giveawayId, userId) {
  db.prepare('DELETE FROM giveaway_participants WHERE giveaway_id = ? AND user_id = ?')
    .run(giveawayId, userId);
}

export function getParticipantIds(giveawayId) {
  return db.prepare('SELECT user_id FROM giveaway_participants WHERE giveaway_id = ?')
    .all(giveawayId).map(r => r.user_id);
}
