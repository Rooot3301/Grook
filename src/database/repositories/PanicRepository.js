import db from '../index.js';

const upsert = db.prepare(`
  INSERT INTO panic_snapshots (guild_id, channel_id, send_messages_overwrite, rate_limit_per_user, created_at)
  VALUES (?, ?, ?, ?, unixepoch())
  ON CONFLICT(guild_id, channel_id) DO UPDATE SET
    send_messages_overwrite = excluded.send_messages_overwrite,
    rate_limit_per_user     = excluded.rate_limit_per_user,
    created_at              = excluded.created_at
`);

/**
 * Sauvegarde l'état d'un salon avant /panic on.
 * @param {string} guildId
 * @param {string} channelId
 * @param {'unset'|'true'|'false'} sendMessagesOverwrite  état de l'overwrite everyone→SendMessages
 * @param {number} rateLimitPerUser  slowmode courant (secondes)
 */
export function snapshotChannel(guildId, channelId, sendMessagesOverwrite, rateLimitPerUser = 0) {
  upsert.run(guildId, channelId, sendMessagesOverwrite, rateLimitPerUser);
}

/** Snapshots pour tous les salons d'un serveur (utilisé par /panic off). */
export function getGuildSnapshots(guildId) {
  return db.prepare('SELECT * FROM panic_snapshots WHERE guild_id = ?').all(guildId);
}

/** Vide tous les snapshots d'un serveur après restauration. */
export function clearGuildSnapshots(guildId) {
  db.prepare('DELETE FROM panic_snapshots WHERE guild_id = ?').run(guildId);
}
