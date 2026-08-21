import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { VERSION } from '../../version.js';
import { COLORS } from '../../utils/embeds.js';

const CATEGORY_META = {
  moderation: { icon: '🛡️', label: 'Modération',    order: 1 },
  config:     { icon: '⚙️', label: 'Configuration', order: 2 },
  fun:        { icon: '🎭', label: 'Fun',           order: 3 },
  games:      { icon: '🎮', label: 'Mini-jeux',     order: 4 },
  util:       { icon: '🔧', label: 'Utilitaires',   order: 5 },
};

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Liste des commandes disponibles, avec descriptions.');

/**
 * Construit dynamiquement les lignes du help en lisant `data.description` et
 * `data.options` de chaque commande enregistrée dans `client.commands`.
 *
 * Format par ligne :
 *   /cmd sub            Description
 *
 * Les sous-commandes sont dépliées pour être vraiment utiles.
 */
function buildLines(cmd) {
  const json = cmd.data.toJSON();
  const rootDesc = json.description || '';
  const lines = [];

  // Sous-commandes (au niveau 1) ou sous-groupes (niveau 2)
  const subs = (json.options || []).filter(o => o.type === 1 || o.type === 2);

  if (!subs.length) {
    lines.push({ name: `/${json.name}`, desc: rootDesc });
    return lines;
  }

  for (const opt of subs) {
    if (opt.type === 1) {
      lines.push({ name: `/${json.name} ${opt.name}`, desc: opt.description || rootDesc });
    } else if (opt.type === 2) {
      // Sous-groupe : dépile les sous-commandes du sous-groupe
      for (const sub of opt.options || []) {
        lines.push({ name: `/${json.name} ${opt.name} ${sub.name}`, desc: sub.description || rootDesc });
      }
    }
  }
  return lines;
}

export async function execute(interaction, client) {
  const byCat = new Map();
  for (const [, cmd] of client.commands) {
    if (!byCat.has(cmd.category)) byCat.set(cmd.category, []);
    byCat.get(cmd.category).push(...buildLines(cmd));
  }

  // Tri des catégories selon `order`, puis alphabétique
  const sortedCats = [...byCat.entries()].sort(([a], [b]) => {
    return (CATEGORY_META[a]?.order ?? 99) - (CATEGORY_META[b]?.order ?? 99);
  });

  const embed = new EmbedBuilder()
    .setTitle(`📖 Aide — Grook v${VERSION}`)
    .setColor(COLORS.INFO)
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription('Chaque ligne = une commande utilisable.')
    .setFooter({ text: `${client.guilds.cache.size} serveur(s) · /config pour la config · /botinfo pour les infos` })
    .setTimestamp();

  for (const [category, lines] of sortedCats) {
    const meta = CATEGORY_META[category] ?? { icon: '📁', label: category };
    lines.sort((a, b) => a.name.localeCompare(b.name));

    // Discord limite un field à 1024 chars — on split si nécessaire.
    const chunks = [];
    let current = '';
    for (const line of lines) {
      const entry = `\`${line.name.padEnd(24, ' ')}\` ${line.desc}\n`;
      if (current.length + entry.length > 1000) { chunks.push(current); current = ''; }
      current += entry;
    }
    if (current) chunks.push(current);

    for (const [i, chunk] of chunks.entries()) {
      embed.addFields({
        name:  `${meta.icon} ${meta.label}${chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ''}`,
        value: chunk,
        inline: false,
      });
    }
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
