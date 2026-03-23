import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { loadCommands } from './loaders/commands.js';
import { loadEvents } from './loaders/events.js';
import { logger } from './utils/logger.js';

loadEnv();

if (!process.env.DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN manquant dans .env — arrêt.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Registre des handlers dynamiques (boutons, modals des jeux)
client.interactionHandlers = new Map();

await loadCommands(client);
await loadEvents(client);

client.login(process.env.DISCORD_TOKEN).catch(err => {
  logger.error('Connexion Discord impossible :', err.message);
  process.exit(1);
});

// Arrêt propre
function shutdown(signal) {
  logger.info(`Signal ${signal} reçu — arrêt propre en cours…`);
  client.destroy();
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Erreurs non gérées (évite les crashes silencieux)
process.on('uncaughtException', err => logger.error('Exception non capturée :', err));
process.on('unhandledRejection', reason => logger.warn('Promesse rejetée non gérée :', reason));
