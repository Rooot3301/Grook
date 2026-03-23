import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'grook.db'));

// Paramètres de performance recommandés
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Schéma initial
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id           TEXT PRIMARY KEY,
    modlogs_channel_id TEXT,
    welcome_channel_id TEXT,
    vt_scanner         INTEGER DEFAULT 0,
    -- Easter eggs (1 = actif, 0 = désactivé)
    egg_rickroll       INTEGER DEFAULT 1,
    egg_stare          INTEGER DEFAULT 1,
    egg_fake_crash     INTEGER DEFAULT 1,
    egg_keywords       INTEGER DEFAULT 1,
    egg_nice           INTEGER DEFAULT 1,
    egg_lazy           INTEGER DEFAULT 1,
    created_at         INTEGER DEFAULT (unixepoch()),
    updated_at         INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS cases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id      TEXT    NOT NULL,
    guild_id     TEXT    NOT NULL,
    type         TEXT    NOT NULL,
    user_id      TEXT    NOT NULL,
    moderator_id TEXT    NOT NULL,
    reason       TEXT    DEFAULT 'Aucune raison',
    expires_at   INTEGER,
    created_at   INTEGER DEFAULT (unixepoch()),
    UNIQUE(guild_id, case_id)
  );
  CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON cases(guild_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_cases_guild      ON cases(guild_id);

  CREATE TABLE IF NOT EXISTS warnings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason       TEXT DEFAULT 'Aucune raison',
    created_at   INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);

  CREATE TABLE IF NOT EXISTS game_stats (
    guild_id TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    game     TEXT NOT NULL,
    wins     INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, game)
  );

  CREATE TABLE IF NOT EXISTS temp_bans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT    NOT NULL,
    user_id      TEXT    NOT NULL,
    moderator_id TEXT    NOT NULL,
    reason       TEXT    DEFAULT 'Aucune raison',
    expires_at   INTEGER NOT NULL,
    created_at   INTEGER DEFAULT (unixepoch()),
    UNIQUE(guild_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_tempbans_expires ON temp_bans(expires_at);

  CREATE TABLE IF NOT EXISTS reminders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    channel_id TEXT    NOT NULL,
    guild_id   TEXT    NOT NULL,
    message    TEXT    NOT NULL,
    fires_at   INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_reminders_fires ON reminders(fires_at);

  CREATE TABLE IF NOT EXISTS afk_status (
    user_id  TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    reason   TEXT DEFAULT 'AFK',
    set_at   INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT,
    prize      TEXT NOT NULL,
    host_id    TEXT NOT NULL,
    ends_at    INTEGER NOT NULL,
    ended      INTEGER DEFAULT 0,
    winner_id  TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_giveaways_ends ON giveaways(ends_at, ended);
`);

// Migration : ajout des colonnes easter eggs sur les DB existantes
const eggCols = ['egg_rickroll', 'egg_stare', 'egg_fake_crash', 'egg_keywords', 'egg_nice', 'egg_lazy'];
const existingCols = db.prepare("PRAGMA table_info(guild_configs)").all().map(r => r.name);
for (const col of eggCols) {
  if (!existingCols.includes(col)) {
    db.exec(`ALTER TABLE guild_configs ADD COLUMN ${col} INTEGER DEFAULT 1`);
  }
}

export default db;
