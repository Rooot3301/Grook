import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelSelectMenuBuilder,
} from 'discord.js';
import { getGuildConfig, setGuildConfig, resetGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { getAutomodConfig, setAutomodConfig, resetAutomodConfig } from '../../database/repositories/AutomodRepository.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configurer Grook pour ce serveur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  // /config panel  — wizard interactif (embed + boutons + selects)
  .addSubcommand(sub => sub
    .setName('panel')
    .setDescription('Panneau interactif de configuration.'))
  // /config view
  .addSubcommand(sub => sub
    .setName('view')
    .setDescription('Voir la configuration actuelle du serveur.'))
  // /config reset
  .addSubcommand(sub => sub
    .setName('reset')
    .setDescription('Remettre la configuration du serveur aux valeurs par défaut.'))
  // /config modlogs set|disable
  .addSubcommandGroup(grp => grp
    .setName('modlogs')
    .setDescription('Gestion des logs de modération.')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Définir le salon des logs de modération.')
      .addChannelOption(o => o
        .setName('salon')
        .setDescription('Salon textuel cible')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('Désactiver les logs de modération.')))
  // /config scanner enable|disable
  .addSubcommandGroup(grp => grp
    .setName('scanner')
    .setDescription('Gestion du scanner VirusTotal.')
    .addSubcommand(sub => sub
      .setName('enable')
      .setDescription('Activer le scanner de liens VirusTotal.'))
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('Désactiver le scanner de liens VirusTotal.')))
  // /config antiscam toggle
  .addSubcommandGroup(grp => grp
    .setName('antiscam')
    .setDescription('Anti-scam : supprime les token grabbers connus (MrBeast, Nitro, Steam, etc.).')
    .addSubcommand(sub => sub
      .setName('enable')
      .setDescription('Activer l\'anti-scam.'))
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('Désactiver l\'anti-scam.')))
  // /config welcome set|disable
  .addSubcommandGroup(grp => grp
    .setName('welcome')
    .setDescription('Gestion du salon de bienvenue.')
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Définir le salon de bienvenue.')
      .addChannelOption(o => o
        .setName('salon')
        .setDescription('Salon textuel cible')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('disable')
      .setDescription('Désactiver les messages de bienvenue.')))
  // /config automod view|toggle|set|reset
  .addSubcommandGroup(grp => grp
    .setName('automod')
    .setDescription('Escalade automatique sur seuils de warns.')
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('Voir la config automod actuelle.'))
    .addSubcommand(sub => sub
      .setName('toggle')
      .setDescription('Activer/désactiver l\'automod.')
      .addBooleanOption(o => o.setName('enabled').setDescription('true = activer').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Définir les seuils. Passe 0 pour désactiver un seuil.')
      .addIntegerOption(o => o.setName('mute_at')      .setDescription('Warns avant mute auto (0 = désactivé)').setMinValue(0).setMaxValue(100))
      .addIntegerOption(o => o.setName('mute_duration').setDescription('Durée mute en secondes (min 60)')       .setMinValue(0).setMaxValue(28 * 24 * 3600))
      .addIntegerOption(o => o.setName('kick_at')      .setDescription('Warns avant kick auto (0 = désactivé)').setMinValue(0).setMaxValue(100))
      .addIntegerOption(o => o.setName('ban_at')       .setDescription('Warns avant ban auto (0 = désactivé)') .setMinValue(0).setMaxValue(100)))
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('Remettre l\'automod à zéro (désactivé, seuils vides).')));

export async function execute(interaction, client) {
  const group   = interaction.options.getSubcommandGroup(false);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  // ── /config panel ── wizard interactif ──────────────────────────────────
  if (!group && sub === 'panel') return openPanel(interaction);

  // ── /config view ─────────────────────────────────────────────────────────
  if (!group && sub === 'view') {
    const cfg   = getGuildConfig(guildId);
    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Configuration — ${interaction.guild.name}`)
      .setColor(COLORS.INFO)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '📋 Logs de modération', value: cfg.modlogs_channel_id ? `<#${cfg.modlogs_channel_id}>` : '`Non configuré`', inline: true },
        { name: '👋 Salon de bienvenue', value: cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : '`Non configuré`', inline: true },
        { name: '🔍 Scanner VT',         value: cfg.vt_scanner ? '`✅ Activé`' : '`❌ Désactivé`', inline: true },
      )
      .setFooter({ text: `Serveur ID : ${guildId}` })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── /config reset ─────────────────────────────────────────────────────────
  if (!group && sub === 'reset') {
    const confirmId = `config_reset_confirm_${Date.now()}`;
    const cancelId  = `config_reset_cancel_${Date.now()}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(confirmId).setLabel('Confirmer la réinitialisation').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
      new ButtonBuilder().setCustomId(cancelId).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
      content: '⚠️ **Êtes-vous sûr ?** Cette action réinitialisera **toute** la configuration du serveur (modlogs, welcome, scanner VT).',
      components: [row],
      ephemeral: true,
    });

    const cleanup = () => {
      client.interactionHandlers.delete(confirmId);
      client.interactionHandlers.delete(cancelId);
    };

    client.interactionHandlers.set(confirmId, async btn => {
      if (btn.user.id !== interaction.user.id) return btn.reply({ content: '❌ Seul l\'auteur de la commande peut confirmer.', ephemeral: true });
      cleanup();
      resetGuildConfig(guildId);
      await btn.update({ content: '✅ Configuration réinitialisée aux valeurs par défaut.', components: [] });
    });

    client.interactionHandlers.set(cancelId, async btn => {
      if (btn.user.id !== interaction.user.id) return btn.reply({ content: '❌ Seul l\'auteur de la commande peut annuler.', ephemeral: true });
      cleanup();
      await btn.update({ content: '❌ Réinitialisation annulée.', components: [] });
    });

    // Auto-nettoyage après 30s
    setTimeout(cleanup, 30_000);
    return;
  }

  // ── /config modlogs ───────────────────────────────────────────────────────
  if (group === 'modlogs') {
    if (sub === 'set') {
      const channel = interaction.options.getChannel('salon', true);
      setGuildConfig(guildId, { modlogs_channel_id: channel.id });
      return interaction.reply({ content: `✅ Logs de modération → ${channel}.`, ephemeral: true });
    }
    if (sub === 'disable') {
      setGuildConfig(guildId, { modlogs_channel_id: null });
      return interaction.reply({ content: '✅ Logs de modération désactivés.', ephemeral: true });
    }
  }

  // ── /config scanner ───────────────────────────────────────────────────────
  if (group === 'scanner') {
    if (sub === 'enable') {
      if (!process.env.VIRUSTOTAL_API_KEY?.trim()) {
        return interaction.reply({ content: '❌ Aucune clé API VirusTotal configurée sur le bot (`VIRUSTOTAL_API_KEY`).', ephemeral: true });
      }
      setGuildConfig(guildId, { vt_scanner: 1 });
      return interaction.reply({ content: '✅ Scanner VirusTotal activé.', ephemeral: true });
    }
    if (sub === 'disable') {
      setGuildConfig(guildId, { vt_scanner: 0 });
      return interaction.reply({ content: '✅ Scanner VirusTotal désactivé.', ephemeral: true });
    }
  }

  // ── /config antiscam ──────────────────────────────────────────────────────
  if (group === 'antiscam') {
    if (sub === 'enable') {
      setGuildConfig(guildId, { anti_scam: 1 });
      return interaction.reply({ content: '✅ Anti-scam activé — les token grabbers connus seront supprimés + timeout 2h.', ephemeral: true });
    }
    if (sub === 'disable') {
      setGuildConfig(guildId, { anti_scam: 0 });
      return interaction.reply({ content: '✅ Anti-scam désactivé.', ephemeral: true });
    }
  }

  // ── /config welcome ───────────────────────────────────────────────────────
  if (group === 'welcome') {
    if (sub === 'set') {
      const channel = interaction.options.getChannel('salon', true);
      setGuildConfig(guildId, { welcome_channel_id: channel.id });
      return interaction.reply({ content: `✅ Salon de bienvenue → ${channel}.`, ephemeral: true });
    }
    if (sub === 'disable') {
      setGuildConfig(guildId, { welcome_channel_id: null });
      return interaction.reply({ content: '✅ Messages de bienvenue désactivés.', ephemeral: true });
    }
  }

  // ── /config automod ───────────────────────────────────────────────────────
  if (group === 'automod') {
    if (sub === 'view') {
      const cfg = getAutomodConfig(guildId);
      const embed = new EmbedBuilder()
        .setTitle('🤖 Automod')
        .setColor(cfg.enabled ? COLORS.WARN : COLORS.INFO)
        .addFields(
          { name: '🔘 Actif',       value: cfg.enabled ? '`✅ Oui`' : '`❌ Non`',                                     inline: true },
          { name: '🔇 Mute',        value: cfg.warn_mute_at ? `\`${cfg.warn_mute_at}\` warns → ${cfg.warn_mute_duration ?? 3600}s` : '`—`', inline: true },
          { name: '👢 Kick',        value: cfg.warn_kick_at ? `\`${cfg.warn_kick_at}\` warns` : '`—`',                inline: true },
          { name: '🔨 Ban',         value: cfg.warn_ban_at  ? `\`${cfg.warn_ban_at}\` warns`  : '`—`',                 inline: true },
        )
        .setFooter({ text: 'Modifie avec /config automod set — 0 pour désactiver un seuil.' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled', true);
      setAutomodConfig(guildId, { enabled: enabled ? 1 : 0 });
      return interaction.reply({ content: `✅ Automod ${enabled ? 'activé' : 'désactivé'}.`, ephemeral: true });
    }
    if (sub === 'set') {
      const patch = {};
      const muteAt   = interaction.options.getInteger('mute_at');
      const muteDur  = interaction.options.getInteger('mute_duration');
      const kickAt   = interaction.options.getInteger('kick_at');
      const banAt    = interaction.options.getInteger('ban_at');

      if (muteAt !== null)  patch.warn_mute_at       = muteAt  === 0 ? null : muteAt;
      if (muteDur !== null) patch.warn_mute_duration = muteDur === 0 ? null : Math.max(60, muteDur);
      if (kickAt !== null)  patch.warn_kick_at       = kickAt  === 0 ? null : kickAt;
      if (banAt !== null)   patch.warn_ban_at        = banAt   === 0 ? null : banAt;

      if (!Object.keys(patch).length) {
        return interaction.reply({ content: '❌ Passe au moins un seuil.', ephemeral: true });
      }
      setAutomodConfig(guildId, patch);
      return interaction.reply({
        content: `✅ Automod mis à jour. Utilise \`/config automod view\` pour voir l'état.`,
        ephemeral: true,
      });
    }
    if (sub === 'reset') {
      resetAutomodConfig(guildId);
      return interaction.reply({ content: '✅ Automod réinitialisé (désactivé, seuils vides).', ephemeral: true });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard interactif — /config panel
// ─────────────────────────────────────────────────────────────────────────────
async function openPanel(interaction) {
  const gid = interaction.guild.id;
  const msg = await interaction.reply({
    embeds: [buildPanelHome(interaction, gid)],
    components: buildPanelRows('home'),
    ephemeral: true,
    fetchReply: true,
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith('cfgp:'),
    time: 5 * 60_000,
  });

  collector.on('collect', async i => {
    const parts  = i.customId.split(':');
    const action = parts[1];

    if (action === 'home') {
      return i.update({ embeds: [buildPanelHome(interaction, gid)], components: buildPanelRows('home') });
    }
    if (action === 'section') {
      const section = parts[2];
      return i.update({ embeds: [buildPanelSection(interaction, gid, section)], components: buildPanelRows(section) });
    }
    if (action === 'toggle') {
      const key = parts[2];
      const cfg = getGuildConfig(gid);
      if (key === 'vt')      setGuildConfig(gid, { vt_scanner: cfg.vt_scanner ? 0 : 1 });
      else if (key === 'as') setGuildConfig(gid, { anti_scam:  cfg.anti_scam  ? 0 : 1 });
      else if (key === 'am') setAutomodConfig(gid, { enabled: getAutomodConfig(gid).enabled ? 0 : 1 });
      const section = parts[3] || 'home';
      return i.update({ embeds: [buildPanelSection(interaction, gid, section)], components: buildPanelRows(section) });
    }
    if (action === 'set-channel') {
      const key = parts[2];
      const [chId] = i.values;
      if (key === 'modlogs') setGuildConfig(gid, { modlogs_channel_id: chId });
      if (key === 'welcome') setGuildConfig(gid, { welcome_channel_id: chId });
      return i.update({ embeds: [buildPanelSection(interaction, gid, 'channels')], components: buildPanelRows('channels') });
    }
    if (action === 'clear-channel') {
      const key = parts[2];
      if (key === 'modlogs') setGuildConfig(gid, { modlogs_channel_id: null });
      if (key === 'welcome') setGuildConfig(gid, { welcome_channel_id: null });
      return i.update({ embeds: [buildPanelSection(interaction, gid, 'channels')], components: buildPanelRows('channels') });
    }
    if (action === 'reset-all') {
      resetGuildConfig(gid);
      resetAutomodConfig(gid);
      return i.update({ embeds: [buildPanelHome(interaction, gid)], components: buildPanelRows('home') });
    }
  });

  collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
}

function buildPanelHome(interaction, gid) {
  const cfg  = getGuildConfig(gid);
  const auto = getAutomodConfig(gid);
  return new EmbedBuilder()
    .setTitle('⚙️ Panneau de configuration')
    .setColor(COLORS.INFO)
    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
    .setDescription(`**${interaction.guild.name}** — utilise les boutons pour naviguer.`)
    .addFields(
      { name: '📋 Salons',       value: `Modlogs : ${cfg.modlogs_channel_id ? `<#${cfg.modlogs_channel_id}>` : '`—`'}\nBienvenue : ${cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : '`—`'}`, inline: true },
      { name: '🔍 Scanner VT',   value: cfg.vt_scanner ? '`✅ Actif`' : '`❌`', inline: true },
      { name: '🛡️ Anti-scam',    value: cfg.anti_scam  ? '`✅ Actif`' : '`❌`', inline: true },
      { name: '🤖 Automod',       value: auto.enabled ? `\`✅\` Mute :\`${auto.warn_mute_at ?? '—'}\` · Kick :\`${auto.warn_kick_at ?? '—'}\` · Ban :\`${auto.warn_ban_at ?? '—'}\`` : '`❌`', inline: false },
    )
    .setFooter({ text: 'Ce panneau se ferme après 5 minutes d\'inactivité.' });
}

function buildPanelSection(interaction, gid, section) {
  const cfg  = getGuildConfig(gid);
  const auto = getAutomodConfig(gid);

  if (section === 'channels') {
    return new EmbedBuilder()
      .setTitle('📋 Salons')
      .setColor(COLORS.INFO)
      .setDescription('Choisis un salon via les menus. Bouton "Retirer" pour vider.')
      .addFields(
        { name: '🛡️ Modlogs',    value: cfg.modlogs_channel_id ? `<#${cfg.modlogs_channel_id}>` : '`—`', inline: true },
        { name: '👋 Bienvenue',   value: cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : '`—`', inline: true },
      );
  }
  if (section === 'security') {
    return new EmbedBuilder()
      .setTitle('🛡️ Sécurité')
      .setColor(COLORS.INFO)
      .addFields(
        { name: '🔍 Scanner VirusTotal', value: cfg.vt_scanner ? '`✅ Actif`' : '`❌`', inline: true },
        { name: '🛡️ Anti-scam',           value: cfg.anti_scam ? '`✅ Actif`' : '`❌`', inline: true },
      )
      .setFooter({ text: 'Le scanner VT nécessite VIRUSTOTAL_API_KEY côté serveur.' });
  }
  if (section === 'automod') {
    return new EmbedBuilder()
      .setTitle('🤖 Automod')
      .setColor(auto.enabled ? COLORS.WARN : COLORS.INFO)
      .setDescription('Escalade auto sur seuils de warn. Configure les seuils via `/config automod set`.')
      .addFields(
        { name: '🔘 Actif', value: auto.enabled ? '`✅ Oui`' : '`❌`', inline: true },
        { name: '🔇 Mute',  value: auto.warn_mute_at ? `\`${auto.warn_mute_at}\` warns · \`${auto.warn_mute_duration ?? 3600}s\`` : '`—`', inline: true },
        { name: '👢 Kick',  value: auto.warn_kick_at ? `\`${auto.warn_kick_at}\` warns` : '`—`', inline: true },
        { name: '🔨 Ban',   value: auto.warn_ban_at  ? `\`${auto.warn_ban_at}\` warns` : '`—`', inline: true },
      );
  }
  return buildPanelHome(interaction, gid);
}

function buildPanelRows(section) {
  if (section === 'home') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfgp:section:channels').setLabel('Salons').setEmoji('📋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfgp:section:security').setLabel('Sécurité').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfgp:section:automod').setLabel('Automod').setEmoji('🤖').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfgp:reset-all').setLabel('Reset tout').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
      ),
    ];
  }
  if (section === 'channels') {
    return [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('cfgp:set-channel:modlogs')
          .setPlaceholder('Choisir le salon modlogs')
          .addChannelTypes(ChannelType.GuildText),
      ),
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId('cfgp:set-channel:welcome')
          .setPlaceholder('Choisir le salon bienvenue')
          .addChannelTypes(ChannelType.GuildText),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfgp:clear-channel:modlogs').setLabel('Retirer modlogs').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfgp:clear-channel:welcome').setLabel('Retirer bienvenue').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfgp:home').setLabel('Retour').setEmoji('←').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }
  if (section === 'security') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfgp:toggle:vt:security').setLabel('Toggle Scanner VT').setEmoji('🔍').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfgp:toggle:as:security').setLabel('Toggle Anti-scam').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfgp:home').setLabel('Retour').setEmoji('←').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }
  if (section === 'automod') {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfgp:toggle:am:automod').setLabel('Toggle Automod').setEmoji('🤖').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('cfgp:home').setLabel('Retour').setEmoji('←').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }
  return buildPanelRows('home');
}
