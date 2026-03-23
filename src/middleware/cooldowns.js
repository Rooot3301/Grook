// Cooldowns en mémoire (Map<commandName, Map<userId, expiresAt>>)
// Éphémères : remis à zéro au redémarrage, ce qui est volontaire.
const cooldowns = new Map();

// Durées personnalisées par commande (en secondes)
const COOLDOWN_MAP = {
  grookflip:     3,
  grookrate:     5,
  grookfortune:  10,
  grookguess:    30,
  grookroulette: 60,
  grooktyper:    20,
  liar:          60,
  grookspy:      60,
  ban:           3,
  kick:          3,
  mute:          3,
  warn:          3,
  tempban:       3,
  softban:       3,
  clear:         5,
  serverinfo:    10,
  snipe:         5,
  editsnipe:     5,
  whois:         5,
  afk:           3,
  giveaway:      10,
};
const DEFAULT_COOLDOWN = 2;

/**
 * Vérifie si un utilisateur est en cooldown pour une commande.
 * Nettoie l'entrée au passage si le cooldown est expiré (évite la fuite mémoire).
 */
export function checkCooldown(commandName, userId) {
  if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
  const userMap   = cooldowns.get(commandName);
  const expiresAt = userMap.get(userId) ?? 0;
  const now = Date.now();

  if (now < expiresAt) {
    return { onCooldown: true, remaining: Math.ceil((expiresAt - now) / 1000) };
  }

  // Nettoyage lazy : on supprime l'entrée expirée
  if (expiresAt > 0) userMap.delete(userId);
  return { onCooldown: false, remaining: 0 };
}

/**
 * Applique le cooldown d'une commande pour un utilisateur.
 */
export function setCooldown(commandName, userId) {
  if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
  const seconds = COOLDOWN_MAP[commandName] ?? DEFAULT_COOLDOWN;
  cooldowns.get(commandName).set(userId, Date.now() + seconds * 1000);
}
