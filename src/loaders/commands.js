import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Charge dynamiquement toutes les commandes depuis src/commands et les enregistre auprès de Discord.
 * Chaque fichier de commande doit exporter `data` (SlashCommandBuilder) et `execute`.
 * @param {import('discord.js').Client} client
 */
export async function loadCommands(client) {
  const commandsDir = path.join(path.resolve(), 'src', 'commands');
  const folders = fs.readdirSync(commandsDir);
  const defs = [];
  client.commands = new Map();
  client.commandCategories = new Map();

  for (const folder of folders) {
    const folderPath = path.join(commandsDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      try {
        const mod = await import(`../commands/${folder}/${file}`);
        const { data, execute } = mod;
        if (!data || !execute) continue;
        defs.push(data.toJSON());
        client.commands.set(data.name, { data, execute, category: folder });
        if (!client.commandCategories.has(folder)) client.commandCategories.set(folder, []);
        client.commandCategories.get(folder).push(data.name);
      } catch (err) {
        logger.error(`[commands] Erreur dans commands/${folder}/${file} :`, err.message);
      }
    }
  }

  client.once('ready', async () => {
    try {
      const devGuildId = process.env.DEV_GUILD_ID;
      if (devGuildId) {
        // Déploiement instantané sur le serveur de dev (pas de cache global 1h)
        const guild = client.guilds.cache.get(devGuildId);
        if (guild) {
          await guild.commands.set(defs);
          logger.info(`[commands] ${defs.length} commande(s) enregistrée(s) sur le serveur de dev (${devGuildId}).`);
        } else {
          logger.warn(`[commands] DEV_GUILD_ID="${devGuildId}" introuvable dans le cache — déploiement global.`);
          await client.application.commands.set(defs);
        }
      } else {
        await client.application.commands.set(defs);
        logger.info(`[commands] ${defs.length} commande(s) enregistrée(s) globalement.`);
      }
    } catch (err) {
      logger.error('[commands] Échec de l\'enregistrement :', err.message);
    }
  });
}
