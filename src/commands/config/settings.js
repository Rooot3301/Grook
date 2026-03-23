import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { getGuildConfig, setGuildConfig, resetGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { COLORS } from '../../utils/embeds.js';

// ─── Métadonnées des easter eggs ──────────────────────────────────────────────
const EGGS = [
  { key: 'rickroll',   col: 'egg_rickroll',   emoji: '🎁', label: 'Rickroll',   freq: '0.4 % / msg',  desc: 'Envoie un lien rickroll de temps en temps' },
  { key: 'stare',      col: 'egg_stare',      emoji: '👀', label: 'Regard',     freq: '0.2 % / msg',  desc: 'Réagit silencieusement avec 👀' },
  { key: 'fake_crash', col: 'egg_fake_crash', emoji: '💥', label: 'Faux crash', freq: '0.15 % / msg', desc: 'Simule un crash critique (auto-delete 5s)' },
  { key: 'keywords',   col: 'egg_keywords',   emoji: '💬', label: 'Mots-clés',  freq: 'selon détection', desc: 'Réagit à "grook", CAPS, insultes, merci, mentions' },
  { key: 'nice',       col: 'egg_nice',       emoji: '😏', label: 'Nice',       freq: '100 % si 69/420', desc: 'Répond "nice" pour les messages de 69 ou 420 chars' },
  { key: 'lazy',       col: 'egg_lazy',       emoji: '😴', label: 'Flemme',     freq: '3.5 % / cmd',  desc: 'Refuse paresseusement d\'exécuter une commande' },
];

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes d'inactivité

// ─── Builders d'embeds ────────────────────────────────────────────────────────

function buildMainEmbed(guild, cfg) {
  const activeEggs  = EGGS.filter(e => cfg[e.col]).length;
  const modlogs     = cfg.modlogs_channel_id ? `<#${cfg.modlogs_channel_id}>` : '`Non configuré`';
  const welcome     = cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : '`Non configuré`';
  const vtScanner   = cfg.vt_scanner ? '`✅ Actif`' : '`❌ Désactivé`';

  return new EmbedBuilder()
    .setTitle('⚙️ Panneau de configuration')
    .setColor(COLORS.INFO)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setDescription(`**${guild.name}** · Seuls les administrateurs peuvent modifier ces paramètres.`)
    .addFields(
      {
        name: '📋 Configuration générale',
        value: [
          `> 🛡️ **Logs modération** — ${modlogs}`,
          `> 👋 **Bienvenue** — ${welcome}`,
          `> 🔍 **Scanner VirusTotal** — ${vtScanner}`,
        ].join('\n'),
        inline: false,
      },
      {
        name: `🥚 Easter eggs — ${activeEggs}/${EGGS.length} actifs`,
        value: EGGS.map(e => {
          const state = cfg[e.col] ? '✅' : '❌';
          return `> ${e.emoji} **${e.label}** ${state} · *${e.freq}*`;
        }).join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: '⏱️ Ce panneau se ferme après 5 minutes d\'inactivité' })
    .setTimestamp();
}

function buildEggsEmbed(guild, cfg) {
  const active = EGGS.filter(e => cfg[e.col]).length;

  return new EmbedBuilder()
    .setTitle('🥚 Easter Eggs')
    .setColor(0x9B59B6)
    .setDescription(
      `**${guild.name}** · ${active}/${EGGS.length} actifs\n` +
      `Cliquez sur un easter egg pour l'activer ou le désactiver.`
    )
    .addFields(
      ...EGGS.map(e => ({
        name: `${e.emoji} ${e.label} — ${cfg[e.col] ? '✅ Actif' : '❌ Désactivé'}`,
        value: `*${e.desc}*\nFréquence : \`${e.freq}\``,
        inline: true,
      }))
    )
    .setFooter({ text: '← Retour pour revenir au menu principal' })
    .setTimestamp();
}

function buildConfigEmbed(guild, cfg) {
  const modlogs = cfg.modlogs_channel_id ? `<#${cfg.modlogs_channel_id}>` : '`Non configuré`';
  const welcome = cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : '`Non configuré`';

  return new EmbedBuilder()
    .setTitle('📋 Configuration générale')
    .setColor(COLORS.INFO)
    .setDescription(`**${guild.name}** · Utilisez \`/config\` pour modifier les salons.`)
    .addFields(
      {
        name: '🛡️ Logs de modération',
        value: `${modlogs}\nToutes les sanctions (ban, kick, mute…) sont envoyées ici.\nModifier : \`/config modlogs set #salon\``,
        inline: false,
      },
      {
        name: '👋 Salon de bienvenue',
        value: `${welcome}\nEmbed de bienvenue envoyé à chaque nouveau membre.\nModifier : \`/config welcome set #salon\``,
        inline: false,
      },
      {
        name: `🔍 Scanner VirusTotal — ${cfg.vt_scanner ? '✅ Actif' : '❌ Désactivé'}`,
        value: `Analyse automatique des liens postés.\nModifier : \`/config scanner enable\` ou \`disable\``,
        inline: false,
      },
    )
    .setFooter({ text: 'Les modifications de salons se font via /config' })
    .setTimestamp();
}

// ─── Builders de composants ───────────────────────────────────────────────────

function mainRows(id) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${id}:eggs`).setLabel('Easter Eggs').setEmoji('🥚').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`${id}:config`).setLabel('Config générale').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${id}:reset`).setLabel('Réinitialiser').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
    ),
  ];
}

function eggsRows(id, cfg) {
  // Ligne 1 : 5 premiers eggs (toggle)
  const row1 = new ActionRowBuilder().addComponents(
    EGGS.slice(0, 5).map(e =>
      new ButtonBuilder()
        .setCustomId(`${id}:egg:${e.key}`)
        .setLabel(e.label)
        .setEmoji(e.emoji)
        .setStyle(cfg[e.col] ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );
  // Ligne 2 : 6e egg + actions globales
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${id}:egg:${EGGS[5].key}`)
      .setLabel(EGGS[5].label)
      .setEmoji(EGGS[5].emoji)
      .setStyle(cfg[EGGS[5].col] ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${id}:eggs:off`).setLabel('Tout OFF').setEmoji('⛔').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`${id}:eggs:on`).setLabel('Tout ON').setEmoji('✅').setStyle(ButtonStyle.Primary),
  );
  // Ligne 3 : retour
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${id}:back`).setLabel('Retour').setEmoji('←').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2, row3];
}

function configRows(id) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${id}:back`).setLabel('Retour').setEmoji('←').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function disabledRows(rows) {
  return rows.map(row =>
    new ActionRowBuilder().addComponents(
      row.components.map(btn => ButtonBuilder.from(btn.toJSON()).setDisabled(true))
    )
  );
}

// ─── Commande ─────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Ouvrir le panneau de configuration interactif du bot.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  const guildId = interaction.guild.id;
  const id      = `settings_${interaction.id}`; // unique par invocation
  let page      = 'main'; // 'main' | 'eggs' | 'config'
  let timeout;

  const getEmbed = () => {
    const cfg = getGuildConfig(guildId);
    if (page === 'eggs')   return { embed: buildEggsEmbed(interaction.guild, cfg),   rows: eggsRows(id, cfg),   cfg };
    if (page === 'config') return { embed: buildConfigEmbed(interaction.guild, cfg), rows: configRows(id),       cfg };
    return { embed: buildMainEmbed(interaction.guild, cfg), rows: mainRows(id), cfg };
  };

  // Envoi initial
  const { embed, rows } = getEmbed();
  const msg = await interaction.reply({ embeds: [embed], components: rows, ephemeral: true, fetchReply: true });

  // ─── Fermeture automatique ──────────────────────────────────────────────────
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      cleanup();
      const { rows: currentRows } = getEmbed();
      await interaction.editReply({ components: disabledRows(currentRows) }).catch(() => {});
    }, TIMEOUT_MS);
  };

  // ─── Nettoyage des handlers ─────────────────────────────────────────────────
  const handlerKeys = [];
  const cleanup = () => {
    clearTimeout(timeout);
    for (const k of handlerKeys) client.interactionHandlers.delete(k);
  };

  // ─── Handler générique pour tous les boutons de ce panneau ─────────────────
  const handleButton = async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      return btn.reply({ content: '❌ Ce panneau ne vous appartient pas.', ephemeral: true });
    }

    resetTimeout();
    const [, action, extra] = btn.customId.split(':'); // id:action:extra

    // ── Navigation ────────────────────────────────────────────────────────────
    if (action === 'eggs')   { page = 'eggs';   const d = getEmbed(); return btn.update({ embeds: [d.embed], components: d.rows }); }
    if (action === 'config') { page = 'config'; const d = getEmbed(); return btn.update({ embeds: [d.embed], components: d.rows }); }
    if (action === 'back')   { page = 'main';   const d = getEmbed(); return btn.update({ embeds: [d.embed], components: d.rows }); }

    // ── Toggle easter egg individuel ──────────────────────────────────────────
    if (action === 'egg') {
      const egg = EGGS.find(e => e.key === extra);
      if (!egg) return;
      const cfg     = getGuildConfig(guildId);
      const newVal  = cfg[egg.col] ? 0 : 1;
      setGuildConfig(guildId, { [egg.col]: newVal });
      const d = getEmbed();
      return btn.update({ embeds: [d.embed], components: d.rows });
    }

    // ── Tout ON / Tout OFF ────────────────────────────────────────────────────
    if (action === 'eggs' && extra === 'on') {
      setGuildConfig(guildId, Object.fromEntries(EGGS.map(e => [e.col, 1])));
      const d = getEmbed();
      return btn.update({ embeds: [d.embed], components: d.rows });
    }
    if (action === 'eggs' && extra === 'off') {
      setGuildConfig(guildId, Object.fromEntries(EGGS.map(e => [e.col, 0])));
      const d = getEmbed();
      return btn.update({ embeds: [d.embed], components: d.rows });
    }

    // ── Réinitialisation avec confirmation inline ─────────────────────────────
    if (action === 'reset') {
      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Confirmer la réinitialisation')
        .setColor(COLORS.ERROR)
        .setDescription(
          'Cette action va **remettre à zéro** toute la configuration du serveur :\n' +
          '> • Salon modlogs supprimé\n' +
          '> • Salon bienvenue supprimé\n' +
          '> • Scanner VT désactivé\n' +
          '> • Tous les easter eggs réactivés\n\n' +
          '**Êtes-vous sûr ?**'
        );
      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${id}:reset:confirm`).setLabel('Confirmer').setEmoji('✅').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`${id}:back`).setLabel('Annuler').setEmoji('✖️').setStyle(ButtonStyle.Secondary),
      );
      return btn.update({ embeds: [confirmEmbed], components: [confirmRow] });
    }

    if (action === 'reset' && extra === 'confirm') {
      resetGuildConfig(guildId);
      page = 'main';
      const d = getEmbed();
      return btn.update({ embeds: [d.embed], components: d.rows });
    }
  };

  // Enregistrement d'un handler générique via préfixe
  // On intercepte tous les customId qui commencent par l'id de session
  const proxyKey = `${id}:`;
  // Hack : on enregistre chaque bouton possible via wildcard en overridant le lookup
  // → On crée un handler spécial dans interactionHandlers avec un préfixe
  // En pratique on enregistre les clés explicitement pour tous les boutons visibles
  const registerAllHandlers = () => {
    const keys = [
      `${id}:eggs`, `${id}:config`, `${id}:back`, `${id}:reset`, `${id}:reset:confirm`,
      `${id}:eggs:on`, `${id}:eggs:off`,
      ...EGGS.map(e => `${id}:egg:${e.key}`),
    ];
    for (const k of keys) {
      if (!handlerKeys.includes(k)) handlerKeys.push(k);
      client.interactionHandlers.set(k, handleButton);
    }
  };

  registerAllHandlers();
  resetTimeout();
}
