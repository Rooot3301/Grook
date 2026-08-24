import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path configurable via GROOK_DB_PATH (tests) — sinon data/grook.db.
// GROOK_DB_PATH=':memory:' fonctionne aussi (utilisé par les tests unitaires).
const DB_PATH = process.env.GROOK_DB_PATH ?? path.join(__dirname, '..', '..', 'data', 'grook.db');

if (DB_PATH !== ':memory:') {
  const DATA_DIR = path.dirname(DB_PATH);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Paramètres de performance recommandés
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Schéma
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id           TEXT PRIMARY KEY,
    modlogs_channel_id TEXT,
    welcome_channel_id TEXT,
    vt_scanner         INTEGER DEFAULT 0,
    created_at         INTEGER DEFAULT (unixepoch()),
    updated_at         INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS cases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id      TEXT    NOT NULL,
    guild_id     TEXT    NOT NULL,
    guild_seq    INTEGER NOT NULL DEFAULT 0,
    type         TEXT    NOT NULL,
    user_id      TEXT    NOT NULL,
    moderator_id TEXT    NOT NULL,
    reason       TEXT    DEFAULT 'Aucune raison',
    notes        TEXT,               -- notes staff ajoutées après-coup (JSON-lines)
    expires_at   INTEGER,
    created_at   INTEGER DEFAULT (unixepoch()),
    UNIQUE(guild_id, case_id),
    UNIQUE(guild_id, guild_seq)
  );
  CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON cases(guild_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_cases_guild      ON cases(guild_id);

  -- Compteur atomique par guild pour la génération sans collision des case_id.
  CREATE TABLE IF NOT EXISTS guild_counters (
    guild_id  TEXT PRIMARY KEY,
    next_case INTEGER NOT NULL DEFAULT 1
  );

  -- Snapshot avant /panic on — pour restaurer l'état exact au /panic off.
  -- Une ligne par (guild, channel). send_messages_overwrite vaut :
  --   'unset' | 'true' | 'false' (état de l'overwrite everyone -> SendMessages).
  CREATE TABLE IF NOT EXISTS panic_snapshots (
    guild_id                TEXT NOT NULL,
    channel_id              TEXT NOT NULL,
    send_messages_overwrite TEXT NOT NULL,
    rate_limit_per_user     INTEGER NOT NULL DEFAULT 0,
    created_at              INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, channel_id)
  );

  -- Automod : escalade auto sur seuils de warn, DÉSACTIVÉE par défaut.
  -- Chaque seuil est facultatif : NULL = pas d'escalade à ce niveau.
  CREATE TABLE IF NOT EXISTS automod_config (
    guild_id           TEXT PRIMARY KEY,
    enabled            INTEGER NOT NULL DEFAULT 0,
    warn_mute_at       INTEGER,           -- ex : 3 = mute au 3e warn
    warn_mute_duration INTEGER,           -- durée du mute en secondes
    warn_kick_at       INTEGER,           -- ex : 5 = kick au 5e warn
    warn_ban_at        INTEGER,           -- ex : 7 = ban au 7e warn
    updated_at         INTEGER DEFAULT (unixepoch())
  );

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

  CREATE TABLE IF NOT EXISTS giveaway_participants (
    giveaway_id INTEGER NOT NULL,
    user_id     TEXT    NOT NULL,
    PRIMARY KEY (giveaway_id, user_id),
    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
  );
`);

// Migration : supprime les anciennes colonnes egg_* si présentes (issu d'une DB pré-nettoyage)
const legacyEggCols = ['egg_rickroll', 'egg_stare', 'egg_fake_crash', 'egg_keywords', 'egg_nice', 'egg_lazy'];
const existingCols = db.prepare("PRAGMA table_info(guild_configs)").all().map(r => r.name);
for (const col of legacyEggCols) {
  if (existingCols.includes(col)) {
    db.exec(`ALTER TABLE guild_configs DROP COLUMN ${col}`);
  }
}

// Migration : cases.notes (ajouté en 2.8).
const caseColsForNotes = db.prepare("PRAGMA table_info(cases)").all().map(r => r.name);
if (!caseColsForNotes.includes('notes')) {
  db.exec('ALTER TABLE cases ADD COLUMN notes TEXT');
}

// Migration : cases.guild_seq (ajouté en 2.5). Backfill : recalcule depuis id.
const caseCols = db.prepare("PRAGMA table_info(cases)").all().map(r => r.name);
if (!caseCols.includes('guild_seq')) {
  db.exec('ALTER TABLE cases ADD COLUMN guild_seq INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    UPDATE cases SET guild_seq = (
      SELECT COUNT(*) FROM cases c2
      WHERE c2.guild_id = cases.guild_id AND c2.id <= cases.id
    )
  `);
  // Alimente les compteurs pour éviter les collisions futures.
  db.exec(`
    INSERT OR REPLACE INTO guild_counters (guild_id, next_case)
    SELECT guild_id, MAX(guild_seq) + 1 FROM cases GROUP BY guild_id
  `);
}

/**
 * Backup atomique de la DB vers `destPath`. Utilise l'API .backup() de
 * better-sqlite3 — pas de copie brute d'un fichier WAL en cours d'écriture.
 * @param {string} destPath
 * @returns {Promise<void>}
 */
export function backupDatabase(destPath) {
  return db.backup(destPath);
}

export default db;
