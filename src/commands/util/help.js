import {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { VERSION } from '../../version.js';
import { COLORS } from '../../utils/embeds.js';

const CATEGORY_META = {
  moderation: { icon: '🛡️', label: 'Modération',    order: 1, color: COLORS.MUTE   },
  config:     { icon: '⚙️', label: 'Configuration', order: 2, color: COLORS.INFO   },
  fun:        { icon: '🎭', label: 'Fun',           order: 3, color: COLORS.FUN    },
  games:      { icon: '🎮', label: 'Mini-jeux',     order: 4, color: COLORS.GAME   },
  util:       { icon: '🔧', label: 'Utilitaires',   order: 5, color: COLORS.INFO   },
};

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Liste des commandes ou détail d\'une commande précise.')
  .addStringOption(o => o
    .setName('commande')
    .setDescription('Nom d\'une commande pour voir son détail (autocomplete)')
    .setRequired(false)
    .setAutocomplete(true));

// ─── Autocomplete : nom de commande ────────────────────────────────────────
export async function autocomplete(interaction) {
  const focused = interaction.options.getFocused()?.toString().toLowerCase() ?? '';
  const client  = interaction.client;
  const names   = [];

  for (const [name, cmd] of client.commands) {
    const json = cmd.data.toJSON();
    const subs = (json.options || []).filter(o => o.type === 1 || o.type === 2);
    if (subs.length === 0) {
      names.push({ full: `/${name}`, category: cmd.category, desc: json.description });
    } else {
      for (const opt of subs) {
        if (opt.type === 1) {
          names.push({ full: `/${name} ${opt.name}`, category: cmd.category, desc: opt.description });
        } else {
          for (const sub of opt.options || []) {
            names.push({ full: `/${name} ${opt.name} ${sub.name}`, category: cmd.category, desc: sub.description });
          }
        }
      }
    }
  }

  const filtered = names
    .filter(n => !focused || n.full.toLowerCase().includes(focused))
    .slice(0, 25)
    .map(n => ({
      name:  `${n.full}  —  ${n.desc || ''}`.slice(0, 100),
      value: n.full.replace(/^\//, ''),
    }));

  await interaction.respond(filtered);
}

// ─── Extraction des lignes pour une catégorie ──────────────────────────────
function extractLines(cmd) {
  const json = cmd.data.toJSON();
  const rootDesc = json.description || '';
  const lines = [];
  const subs  = (json.options || []).filter(o => o.type === 1 || o.type === 2);

  if (!subs.length) return [{ name: `/${json.name}`, desc: rootDesc }];

  for (const opt of subs) {
    if (opt.type === 1) {
      lines.push({ name: `/${json.name} ${opt.name}`, desc: opt.description || rootDesc });
    } else {
      for (const sub of opt.options || []) {
        lines.push({ name: `/${json.name} ${opt.name} ${sub.name}`, desc: sub.description || rootDesc });
      }
    }
  }
  return lines;
}

// ─── Recherche du détail d'une commande précise ────────────────────────────
function findCommandDetail(client, query) {
  const parts = query.trim().toLowerCase().split(/\s+/);
  const rootName = parts[0];
  const cmd = client.commands.get(rootName);
  if (!cmd) return null;

  const json = cmd.data.toJSON();
  const subs = (json.options || []).filter(o => o.type === 1 || o.type === 2);

  if (subs.length === 0) return { cmd, category: cmd.category, path: `/${rootName}`, description: json.description, options: json.options || [] };

  if (parts.length === 1) {
    // /help ban → montre toutes les subs du groupe
    return { cmd, category: cmd.category, path: `/${rootName}`, description: json.description, subs };
  }

  const subName = parts[1];
  const sub = subs.find(s => s.name === subName);
  if (!sub) return { cmd, category: cmd.category, path: `/${rootName}`, description: json.description, subs };

  if (sub.type === 1) {
    return { cmd, category: cmd.category, path: `/${rootName} ${subName}`, description: sub.description, options: sub.options || [] };
  }
  // Sous-groupe → cherche la sub 3e niveau
  const groupSubs = sub.options || [];
  if (parts.length === 2) return { cmd, category: cmd.category, path: `/${rootName} ${subName}`, description: sub.description, subs: groupSubs };
  const leaf = groupSubs.find(s => s.name === parts[2]);
  if (!leaf) return { cmd, category: cmd.category, path: `/${rootName} ${subName}`, description: sub.description, subs: groupSubs };
  return { cmd, category: cmd.category, path: `/${rootName} ${subName} ${leaf.name}`, description: leaf.description, options: leaf.options || [] };
}

// ─── Rendu ───────────────────────────────────────────────────────────────────
const OPTION_TYPE_LABELS = {
  3:  'texte', 4: 'entier', 5: 'oui/non', 6: 'utilisateur',
  7:  'salon', 8: 'rôle',   9: 'mention', 10: 'nombre',
  11: 'pièce jointe',
};

function buildDetailEmbed(detail, guildCount) {
  const meta = CATEGORY_META[detail.category] ?? { icon: '📁', label: detail.category, color: COLORS.INFO };
  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.icon} \`${detail.path}\``)
    .setDescription(detail.description || '*(aucune description)*')
    .setFooter({ text: `Catégorie : ${meta.label} · Grook v${VERSION} · ${guildCount} serveur(s)` });

  if (detail.subs?.length) {
    const list = detail.subs.map(s => {
      const path = s.type === 2 ? `${detail.path} ${s.name} <sub>` : `${detail.path} ${s.name}`;
      return `\`${path}\` — ${s.description || ''}`;
    }).join('\n');
    embed.addFields({ name: 'Sous-commandes', value: list.slice(0, 1024) });
  }

  if (detail.options?.length) {
    const list = detail.options.map(o => {
      const typeName = OPTION_TYPE_LABELS[o.type] || `type ${o.type}`;
      const req = o.required ? '**(obligatoire)**' : '*(optionnel)*';
      return `\`${o.name}\` · ${typeName} · ${req}\n  ↳ ${o.description || ''}`;
    }).join('\n');
    embed.addFields({ name: 'Options', value: list.slice(0, 1024) });
  }

  return embed;
}

function buildCategoryEmbed(client, category) {
  const meta = CATEGORY_META[category] ?? { icon: '📁', label: category, color: COLORS.INFO };
  const cmds = [...client.commands.values()].filter(c => c.category === category);
  const lines = cmds.flatMap(extractLines).sort((a, b) => a.name.localeCompare(b.name));

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`${meta.icon} ${meta.label}`)
    .setDescription(`${lines.length} commande(s). Tape \`/help commande:<nom>\` pour le détail.`);

  // Split en chunks pour rester sous 1024 chars par field.
  let current = '';
  let chunkN  = 0;
  for (const line of lines) {
    const entry = `\`${line.name.padEnd(24, ' ')}\` ${line.desc}\n`;
    if (current.length + entry.length > 1000) {
      embed.addFields({ name: `Suite ${++chunkN}`, value: current });
      current = '';
    }
    current += entry;
  }
  if (current) embed.addFields({ name: chunkN === 0 ? 'Commandes' : `Suite ${chunkN + 1}`, value: current });

  return embed;
}

function buildRow(currentCat) {
  const cats = Object.entries(CATEGORY_META).sort(([, a], [, b]) => a.order - b.order);
  return new ActionRowBuilder().addComponents(
    ...cats.map(([key, meta]) => new ButtonBuilder()
      .setCustomId(`help_cat_${key}`)
      .setLabel(meta.label)
      .setEmoji(meta.icon)
      .setStyle(key === currentCat ? ButtonStyle.Primary : ButtonStyle.Secondary))
  );
}

// ─── Execute ─────────────────────────────────────────────────────────────────
export async function execute(interaction, client) {
  const query = interaction.options.getString('commande');

  // Mode "détail" — /help commande:<x>
  if (query) {
    const detail = findCommandDetail(client, query);
    if (!detail) {
      return interaction.reply({
        content: `❌ Aucune commande trouvée pour \`${query}\`. Tape \`/help\` sans argument pour voir la liste.`,
        ephemeral: true,
      });
    }
    return interaction.reply({
      embeds: [buildDetailEmbed(detail, client.guilds.cache.size)],
      ephemeral: true,
    });
  }

  // Mode "catégorie" — 5 boutons de navigation
  const defaultCat = 'moderation';
  const embed = buildCategoryEmbed(client, defaultCat);
  const row   = buildRow(defaultCat);
  const msg   = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, fetchReply: true });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith('help_cat_'),
    time: 5 * 60_000,
  });

  collector.on('collect', async btn => {
    const cat = btn.customId.replace('help_cat_', '');
    await btn.update({ embeds: [buildCategoryEmbed(client, cat)], components: [buildRow(cat)] });
  });

  collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
}
