// Cooldowns en mémoire (Map<commandName, Map<userId, expiresAt>>)
// Éphémères : remis à zéro au redémarrage, ce qui est volontaire.
const cooldowns = new Map();

// Durées personnalisées par commande (en secondes)
const COOLDOWN_MAP = {
  grookflip:    3,
  grookrate:    5,
  grookfortune: 10,
  grookguess:   30,
  grookroulette: 60,
  grooktyper:   20,
  liar:         60,
  grookspy:     60,
  ban:          2,
  kick:         2,
  mute:         2,
  warn:         2,
  clear:        5,
  serverinfo:   10,
  userinfo:     5,
};
const DEFAULT_COOLDOWN = 2;

/**
 * Vérifie si un utilisateur est en cooldown pour une commande.
 * @param {string} commandName
 * @param {string} userId
 * @returns {{ onCooldown: boolean, remaining: number }}
 */
export function checkCooldown(commandName, userId) {
  if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
  const expiresAt = cooldowns.get(commandName).get(userId) ?? 0;
  const now = Date.now();
  if (now < expiresAt) {
    return { onCooldown: true, remaining: Math.ceil((expiresAt - now) / 1000) };
  }
  return { onCooldown: false, remaining: 0 };
}

/**
 * Applique le cooldown d'une commande pour un utilisateur.
 * @param {string} commandName
 * @param {string} userId
 */
export function setCooldown(commandName, userId) {
  if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
  const seconds = COOLDOWN_MAP[commandName] ?? DEFAULT_COOLDOWN;
  cooldowns.get(commandName).set(userId, Date.now() + seconds * 1000);
}
