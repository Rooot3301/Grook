// IMPORTANT : dotenv doit être exécuté AVANT que les modules qui lisent
// process.env (logger, config par serveur, etc.) soient importés. En ESM,
// `import 'dotenv/config'` s'exécute avant les imports suivants.
import 'dotenv/config';

import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadCommands } from './loaders/commands.js';
import { loadEvents } from './loaders/events.js';
import { logger } from './utils/logger.js';

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

// Dashboard web (opt-in via DASHBOARD_ENABLED=true) — jamais fatal pour le bot.
let dashboard = null;
if (process.env.DASHBOARD_ENABLED === 'true') {
  // Précheck lisible : liste ce qui manque, pas de crash silencieux.
  const missing = [];
  if (!process.env.DISCORD_CLIENT_ID)     missing.push('DISCORD_CLIENT_ID');
  if (!process.env.DISCORD_CLIENT_SECRET) missing.push('DISCORD_CLIENT_SECRET');
  if (!process.env.BOT_OWNER_ID)          missing.push('BOT_OWNER_ID');

  if (missing.length) {
    logger.error(`[dashboard] Config incomplète — variables manquantes : ${missing.join(', ')}. Dashboard désactivé (le bot continue).`);
  } else {
    try {
      const { startDashboard } = await import('./http/server.js');
      client.once('ready', async () => {
        try { dashboard = await startDashboard(client); }
        catch (err) { logger.error('[dashboard] Démarrage échoué (bot continue) :', err.message); }
      });
    } catch (err) {
      logger.error('[dashboard] Import échoué (bot continue) :', err.message);
    }
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
