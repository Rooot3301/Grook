import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Charge dynamiquement toutes les commandes depuis src/commands (un seul niveau
 * de sous-dossier). Les subdirs `impl/` ne sont pas parcourus.
 *
 * Chaque fichier chargé doit exporter `data` (SlashCommandBuilder) et `execute`.
 * `autocomplete` est optionnel.
 *
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
        const { data, execute, autocomplete } = mod;
        if (!data || !execute) continue;
        defs.push(data.toJSON());
        client.commands.set(data.name, { data, execute, autocomplete, category: folder });
        if (!client.commandCategories.has(folder)) client.commandCategories.set(folder, []);
        client.commandCategories.get(folder).push(data.name);
      } catch (err) {
        logger.error(`[commands] Erreur dans commands/${folder}/${file} :`, err.message);
      }
    }
  }

  client.once('ready', () => syncCommands(client, defs).catch(err =>
    logger.error('[commands] Échec de l\'enregistrement :', err.message)
  ));
}

/**
 * Publie les commandes courantes sur Discord et **wipe le scope opposé** pour
 * éviter les résidus de commandes fantômes.
 *
 * - `DEV_GUILD_ID` set → publie sur cette guild, wipe le global.
 * - sinon             → publie global, wipe la guild active pour chaque guild
 *                       où le bot est présent.
 *
 * Retourne un résumé structuré (utilisable par un futur endpoint API).
 */
export async function syncCommands(client, defs = null) {
  // Si defs pas fourni, on relit depuis client.commands (état courant).
  if (!defs) {
    defs = [...client.commands.values()].map(c => c.data.toJSON());
  }

  const devGuildId = process.env.DEV_GUILD_ID?.trim();
  const summary = { scope: null, published: 0, wiped: [] };

  if (devGuildId) {
    const guild = client.guilds.cache.get(devGuildId);
    if (!guild) {
      logger.warn(`[commands] DEV_GUILD_ID="${devGuildId}" introuvable — fallback global.`);
      await client.application.commands.set(defs);
      summary.scope = 'global-fallback';
      summary.published = defs.length;
      return summary;
    }

    await guild.commands.set(defs);
    logger.info(`[commands] ${defs.length} commande(s) publiée(s) sur la guild ${devGuildId}.`);
    summary.scope = 'guild';
    summary.published = defs.length;

    // Wipe global pour éviter double registration
    try {
      const existing = await client.application.commands.fetch();
      if (existing.size > 0) {
        await client.application.commands.set([]);
        logger.info(`[commands] Global wipe : ${existing.size} commande(s) globale(s) supprimée(s).`);
        summary.wiped.push({ scope: 'global', count: existing.size });
      }
    } catch (err) {
      logger.warn(`[commands] Wipe global échoué : ${err.message}`);
    }
    return summary;
  }

  // Mode global : publie global + wipe chaque guild
  await client.application.commands.set(defs);
  logger.info(`[commands] ${defs.length} commande(s) publiée(s) globalement.`);
  summary.scope = 'global';
  summary.published = defs.length;

  for (const [gid, guild] of client.guilds.cache) {
    try {
      const existing = await guild.commands.fetch();
      if (existing.size > 0) {
        await guild.commands.set([]);
        logger.info(`[commands] Guild wipe : ${existing.size} commande(s) supprimée(s) sur ${guild.name} (${gid}).`);
        summary.wiped.push({ scope: 'guild', guildId: gid, count: existing.size });
      }
    } catch (err) {
      logger.warn(`[commands] Guild wipe échoué pour ${gid} : ${err.message}`);
    }
  }
  return summary;
}
