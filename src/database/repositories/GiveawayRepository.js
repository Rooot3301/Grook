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
