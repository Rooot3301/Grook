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

// Dashboard web (optionnel, activé via DASHBOARD_ENABLED=true)
let dashboard = null;
if (process.env.DASHBOARD_ENABLED === 'true') {
  try {
    const { startDashboard } = await import('./http/server.js');
    client.once('ready', async () => {
      try {
        dashboard = await startDashboard(client);
      } catch (err) {
        logger.error('[dashboard] Démarrage échoué :', err.message);
      }
    });
  } catch (err) {
    logger.error('[dashboard] Import échoué :', err.message);
  }
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  logger.error('Connexion Discord impossible :', err.message);
  process.exit(1);
});

// Arrêt propre
async function shutdown(signal) {
  logger.info(`Signal ${signal} reçu — arrêt propre en cours…`);
  try { await dashboard?.close(); } catch { /* ignore */ }
  client.destroy();
  process.exit(0);
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Erreurs non gérées — on log ET on tue le process : PM2 relance dans un état sain.
// Continuer avec une erreur non-gérée = état incohérent (DB half-committed, sockets zombie…).
process.on('uncaughtException', (err, origin) => {
  logger.error(`[fatal] uncaughtException (${origin}) :`, err);
  try { dashboard?.close(); } catch { /* ignore */ }
  try { client.destroy(); } catch { /* ignore */ }
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('[fatal] unhandledRejection :', reason);
  try { dashboard?.close(); } catch { /* ignore */ }
  try { client.destroy(); } catch { /* ignore */ }
  process.exit(1);
});
