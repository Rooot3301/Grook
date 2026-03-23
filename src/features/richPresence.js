import { ActivityType } from 'discord.js';
import { logger } from '../utils/logger.js';

// Statuts fixes
const STATIC_STATUSES = [
  { type: ActivityType.Watching,  text: 'Créé par Root3301' },
  { type: ActivityType.Playing,   text: 'Grook v2.0' },
  { type: ActivityType.Listening, text: 'les larmes des bannis' },
  { type: ActivityType.Playing,   text: 'Minecraft 2 (early access)' },
  { type: ActivityType.Playing,   text: 'GTA 6 bêta fermée' },
  { type: ActivityType.Competing, text: 'au championnat du spam mondial' },
  { type: ActivityType.Watching,  text: 'vos destins 📜' },
  { type: ActivityType.Watching,  text: 'les logs de modération' },
  { type: ActivityType.Playing,   text: 'avec le code de prod' },
  { type: ActivityType.Listening, text: 'vos commandes slash' },
  { type: ActivityType.Playing,   text: 'à la roulette russe' },
  { type: ActivityType.Watching,  text: 'les serveurs s\'effondrer' },
  { type: ActivityType.Competing, text: 'contre les autres bots' },
  { type: ActivityType.Listening, text: 'Never Gonna Give You Up 🎵' },
  { type: ActivityType.Playing,   text: 'au jeu des prophéties' },
  { type: ActivityType.Competing, text: 'au tournoi du silence' },
  { type: ActivityType.Listening, text: 'les théories du complot' },
  { type: ActivityType.Watching,  text: 'qui va se faire ban en premier' },
  { type: ActivityType.Playing,   text: 'cache-cache avec les raids' },
  { type: ActivityType.Watching,  text: 'votre taux de messages' },
];

let index = 0;

/**
 * Démarre la rotation du rich presence.
 * L'intervalle est configurable via PRESENCE_INTERVAL_MIN (env, défaut 5 min).
 * @param {import('discord.js').Client} client
 */
export function startRichPresenceRotation(client) {
  const intervalMin = Math.max(1, parseFloat(process.env.PRESENCE_INTERVAL_MIN) || 5);
  const intervalMs  = intervalMin * 60 * 1000;

  function rotate() {
    try {
      // Statuts dynamiques (calculés à chaque rotation)
      const dynamic = [
        { type: ActivityType.Watching, text: `${client.guilds.cache.size} serveur(s)` },
      ];
      const all = [...STATIC_STATUSES, ...dynamic];
      const status = all[index % all.length];
      client.user?.setPresence({
        activities: [{ name: status.text, type: status.type }],
        status: 'online',
      });
      index++;
    } catch (err) {
      logger.warn('[richPresence] Erreur de mise à jour :', err.message);
    }
  }

  rotate();
  setInterval(rotate, intervalMs);
  logger.info(`[richPresence] Rotation active (toutes les ${intervalMin} min, ${STATIC_STATUSES.length + 1} statuts)`);
}
