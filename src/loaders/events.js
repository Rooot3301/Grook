import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Charge dynamiquement tous les événements depuis src/events.
 * Chaque fichier doit exporter un objet default avec `name`, `execute`, et optionnellement `once`.
 * @param {import('discord.js').Client} client
 */
export async function loadEvents(client) {
  const eventsDir = path.join(path.resolve(), 'src', 'events');
  if (!fs.existsSync(eventsDir)) return;
  const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'));

  for (const file of files) {
    try {
      const event = (await import(`../events/${file}`)).default;
      if (!event?.name || !event?.execute) continue;
      const listener = (...args) => event.execute(...args, client);
      event.once ? client.once(event.name, listener) : client.on(event.name, listener);
    } catch (err) {
      logger.error(`[events] Erreur dans events/${file} :`, err.message);
    }
  }
}
