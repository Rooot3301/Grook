import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { logger } from './logger.js';

const ENV_PATH = path.resolve('.env');

/**
 * Lit .env et retourne { key: value } (simple KV parser, ignore les lignes
 * commentaires et vides). Ne remplace pas process.env — dotenv le fait déjà.
 */
function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Écrit KEY=VALUE dans .env (upsert). Ligne remplacée si déjà présente,
 * ajoutée à la fin sinon. Idempotent, préserve les commentaires existants.
 */
export function setEnvVar(key, value) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const escaped = String(value).replace(/\r?\n/g, '');
  const re = new RegExp(`^${key}=.*$`, 'm');

  let next;
  if (re.test(current)) {
    next = current.replace(re, `${key}=${escaped}`);
  } else {
    next = current.trimEnd() + `\n${key}=${escaped}\n`;
  }

  fs.writeFileSync(ENV_PATH, next, { mode: 0o600 });
  process.env[key] = escaped;
}

/**
 * Génère un secret hex 64 chars (256 bits) si `key` n'est pas défini dans
 * process.env. Écrit dans .env pour persistance et log l'action.
 * Retourne la valeur (existante ou nouvellement générée).
 */
export function ensureSecret(key) {
  if (process.env[key] && process.env[key].length >= 32) return process.env[key];

  // Cas d'un .env qui a le secret mais dotenv ne l'a pas chargé (édité pendant le run)
  const file = readEnvFile();
  if (file[key] && file[key].length >= 32) {
    process.env[key] = file[key];
    return file[key];
  }

  const secret = crypto.randomBytes(32).toString('hex');
  setEnvVar(key, secret);
  logger.info(`[env] ${key} manquant → généré et écrit dans .env (${secret.slice(0, 8)}…)`);
  return secret;
}
