import db from '../index.js';

export function createReminder({ userId, channelId, guildId, message, firesAt }) {
  const result = db.prepare(`
    INSERT INTO reminders (user_id, channel_id, guild_id, message, fires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, channelId, guildId, message, Math.floor(firesAt / 1000));
  return db.prepare('SELECT * FROM reminders WHERE id = ?').get(result.lastInsertRowid);
}

export function removeReminder(id) {
  db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
}

export function getPendingReminders() {
  return db.prepare('SELECT * FROM reminders ORDER BY fires_at ASC').all();
}

export function getRemindersForUser(userId) {
  return db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY fires_at ASC').all(userId);
}
