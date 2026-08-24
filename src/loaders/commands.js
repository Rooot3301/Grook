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
 * Inventaire des commandes actuellement enregistrées côté Discord.
 * Retourne { global: [{name}], guilds: { [gid]: { name, cmds: [{name}] } } }
 */
export async function inventoryCommands(client) {
  const inv = { global: [], guilds: {} };
  try {
    const g = await client.application.commands.fetch();
    inv.global = [...g.values()].map(c => ({ name: c.name, id: c.id }));
  } catch (err) { logger.warn(`[commands] Fetch global : ${err.message}`); }

  for (const [gid, guild] of client.guilds.cache) {
    try {
      const g = await guild.commands.fetch();
      inv.guilds[gid] = { name: guild.name, cmds: [...g.values()].map(c => ({ name: c.name, id: c.id })) };
    } catch (err) { logger.warn(`[commands] Fetch guild ${gid} : ${err.message}`); }
  }
  return inv;
}

/**
 * Wipe TOUTES les commandes — global + chaque guild.
 * Utilisé par `./grook.sh sync --nuke` pour repartir d'un état vierge.
 */
export async function nukeCommands(client) {
  const wiped = [];
  try {
    const g = await client.application.commands.fetch();
    if (g.size > 0) {
      await client.application.commands.set([]);
      logger.info(`[commands] NUKE global : ${g.size} commande(s) supprimée(s).`);
      wiped.push({ scope: 'global', count: g.size });
    }
  } catch (err) { logger.warn(`[commands] NUKE global échoué : ${err.message}`); }

  for (const [gid, guild] of client.guilds.cache) {
    try {
      const g = await guild.commands.fetch();
      if (g.size > 0) {
        await guild.commands.set([]);
        logger.info(`[commands] NUKE guild ${guild.name} (${gid}) : ${g.size} commande(s).`);
        wiped.push({ scope: 'guild', guildId: gid, name: guild.name, count: g.size });
      }
    } catch (err) { logger.warn(`[commands] NUKE guild ${gid} échoué : ${err.message}`); }
  }
  return wiped;
}

/**
 * Publie les commandes courantes sur Discord et **wipe le scope opposé** pour
 * éviter les résidus de commandes fantômes.
 *
 * - `DEV_GUILD_ID` set → publie sur cette guild, wipe le global.
 * - sinon             → publie global, wipe la guild active pour chaque guild
 *                       où le bot est présent.
 *
 * Options :
 *   { nuke: true }    → wipe global + toutes les guilds AVANT publish
 *
 * Retourne un résumé structuré.
 */
export async function syncCommands(client, defs = null, opts = {}) {
  if (!defs) {
    defs = [...client.commands.values()].map(c => c.data.toJSON());
  }

  const devGuildId = process.env.DEV_GUILD_ID?.trim();
  const summary = { scope: null, published: 0, wiped: [], nuked: false };

  if (opts.nuke) {
    summary.wiped.push(...(await nukeCommands(client)));
    summary.nuked = true;
  }

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

    if (!opts.nuke) {
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
    }
    return summary;
  }

  await client.application.commands.set(defs);
  logger.info(`[commands] ${defs.length} commande(s) publiée(s) globalement.`);
  summary.scope = 'global';
  summary.published = defs.length;

  if (!opts.nuke) {
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
  }
  return summary;
}
