import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Emitter interne pour pousser chaque log fraîchement écrit vers les
 * abonnés (WebSocket du dashboard notamment). Importé indirectement pour
 * éviter le cycle logger <-> http/events.
 */
export const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(0);
const currentLevel = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LEVELS.info;

const jsonMode = process.env.LOG_FORMAT?.toLowerCase() === 'json';
const LOG_DIR  = path.resolve('logs');
const LOG_FILE = path.join(LOG_DIR, 'grook.log');

// Ring buffer en mémoire — utilisé par /api/logs/recent pour éviter de tail
// le fichier à chaque requête. Max 500 lignes.
const BUFFER_MAX = 500;
const buffer = [];

// Écriture asynchrone dans logs/grook.log au format JSON (une entrée = une ligne).
// Rotation "simple" au démarrage : si le fichier dépasse LOG_MAX_BYTES,
// on le renomme en grook.log.1 (en écrasant l'ancien .1) et on démarre neuf.
// Rotation externe (logrotate, PM2's out/error) reste possible sans conflit.
const LOG_MAX_BYTES = Number(process.env.LOG_MAX_BYTES) || 10 * 1024 * 1024; // 10 MB
let writeStream = null;
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size >= LOG_MAX_BYTES) {
      fs.renameSync(LOG_FILE, LOG_FILE + '.1');
    }
  } catch { /* pas de fichier existant */ }
  writeStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
} catch { /* pas de logs sur disque — on continue en mémoire */ }

const COLORS = {
  debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m',
};

function serializeArg(arg) {
  if (arg instanceof Error) return { message: arg.message, stack: arg.stack, name: arg.name };
  return arg;
}

function stringifySafe(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_k, v) => {
    if (typeof v === 'object' && v !== null) {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
    }
    return v;
  });
}

function log(level, args) {
  if (LEVELS[level] < currentLevel) return;

  const ts   = new Date().toISOString();
  const msg  = args.map(a => typeof a === 'string' ? a : stringifySafe(serializeArg(a))).join(' ');
  const entry = { ts, level, msg };

  // Buffer mémoire (le plus récent en tête)
  buffer.unshift(entry);
  if (buffer.length > BUFFER_MAX) buffer.length = BUFFER_MAX;

  // Publish sur l'emitter interne — le WS du dashboard s'y abonne.
  try { logEmitter.emit('log', entry); } catch { /* ignore listener errors */ }

  // Fichier JSON-lines (append)
  writeStream?.write(stringifySafe(entry) + '\n');

  // Console
  if (jsonMode) {
    (level === 'error' ? console.error : console.log)(stringifySafe(entry));
  } else {
    const col = COLORS[level];
    const rst = COLORS.reset;
    const prefix = `${col}[${ts}] [${level.toUpperCase().padEnd(5)}]${rst}`;
    (level === 'error' ? console.error : console.log)(prefix, ...args);
  }
}

export const logger = {
  debug: (...a) => log('debug', a),
  info:  (...a) => log('info',  a),
  warn:  (...a) => log('warn',  a),
  error: (...a) => log('error', a),
};

/** Renvoie les N dernières entrées du ring buffer (récentes en premier). */
export function getRecentLogs(limit = 100, minLevel = 'debug') {
  const min = LEVELS[minLevel] ?? 0;
  return buffer.filter(e => LEVELS[e.level] >= min).slice(0, limit);
}
