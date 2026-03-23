import { startRichPresenceRotation } from '../features/richPresence.js';
import { processExpiredTempBans } from '../features/tempbans.js';
import { loadPendingReminders } from '../features/reminders.js';
import { logger } from '../utils/logger.js';

const TEMPBAN_INTERVAL_MS = 60_000; // vérification toutes les 60s

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`✅ ${client.user.tag} est en ligne — ${client.guilds.cache.size} serveur(s)`);
    startRichPresenceRotation(client);

    // Traitement immédiat des temp-bans expirés au démarrage
    await processExpiredTempBans(client);

    // Recharge les rappels persistés en DB
    loadPendingReminders(client);

    // Puis vérification périodique
    setInterval(() => processExpiredTempBans(client), TEMPBAN_INTERVAL_MS);
  },
};
