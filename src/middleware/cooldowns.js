// Cooldowns en mémoire (Map<commandName, Map<userId, expiresAt>>)
// Éphémères : remis à zéro au redémarrage (volontaire).
const cooldowns = new Map();

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

export function checkCooldown(commandName, userId) {
  if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
  const userMap   = cooldowns.get(commandName);
  const expiresAt = userMap.get(userId) ?? 0;
  const now       = Date.now();

  if (now < expiresAt) {
    return { onCooldown: true, remaining: Math.ceil((expiresAt - now) / 1000) };
  }

  if (expiresAt > 0) userMap.delete(userId);
  return { onCooldown: false, remaining: 0 };
}

export function setCooldown(commandName, userId) {
  if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
  const seconds = COOLDOWN_MAP[commandName] ?? DEFAULT_COOLDOWN;
  cooldowns.get(commandName).set(userId, Date.now() + seconds * 1000);
}
