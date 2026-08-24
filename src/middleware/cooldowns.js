// Cooldowns en mémoire — clé composite (commandName, userId, guildId).
// Un cooldown sur le serveur A ne bloque plus le même user sur le serveur B.
// Éphémères : remis à zéro au redémarrage (volontaire).
const cooldowns = new Map(); // key -> expiresAt

const makeKey = (cmd, userId, guildId) => `${cmd}|${userId}|${guildId ?? 'dm'}`;

// Durées par commande (en secondes) — clé = nom top-level de la commande.
const COOLDOWN_MAP = {
  // Modération
  ban: 3, kick: 3, mute: 3, unmute: 3, warn: 3, tempban: 3, softban: 3,
  unban: 3, clear: 5, channel: 3, panic: 10, announce: 5, report: 30, nick: 3,
  case: 5,
  // Config
  config: 3,
  // Groupes
  user: 3, server: 10, game: 30, fun: 5, snipe: 5,
  // Fun
  poll: 10, giveaway: 10,
  // Util
  remind: 3, afk: 3, ping: 3, botinfo: 5, help: 3, avatar: 3,
};
const DEFAULT_COOLDOWN = 2;

export function checkCooldown(commandName, userId, guildId = null) {
  const key       = makeKey(commandName, userId, guildId);
  const expiresAt = cooldowns.get(key) ?? 0;
  const now       = Date.now();

  if (now < expiresAt) {
    return { onCooldown: true, remaining: Math.ceil((expiresAt - now) / 1000) };
  }
  if (expiresAt > 0) cooldowns.delete(key); // cleanup lazy
  return { onCooldown: false, remaining: 0 };
}

export function setCooldown(commandName, userId, guildId = null) {
  const seconds = COOLDOWN_MAP[commandName] ?? DEFAULT_COOLDOWN;
  cooldowns.set(makeKey(commandName, userId, guildId), Date.now() + seconds * 1000);
}
