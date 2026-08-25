import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { getGuildConfig, setGuildConfig, resetGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { getAutomodConfig, setAutomodConfig, resetAutomodConfig } from '../../database/repositories/AutomodRepository.js';
import { COLORS } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

/**
 * `/config` — 3 sous-commandes seulement pour ne pas polluer l'autocomplete
 * de Discord. Tout le reste passe par le panel interactif.
 *
 *   /config panel   → wizard interactif complet (recommandé)
 *   /config view    → embed statique de l'état
 *   /config reset   → remise à zéro globale (guild + automod)
 */
export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configurer Grook pour ce serveur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('panel')
    .setDescription('Panneau interactif pour tout configurer (recommandé).'))
  .addSubcommand(sub => sub
    .setName('view')
    .setDescription('Voir la configuration actuelle du serveur.'))
  .addSubcommand(sub => sub
    .setName('reset')
    .setDescription('Remettre TOUTE la configuration (config + automod) aux valeurs par défaut.'));

export async function execute(interaction, client) {
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

  if (sub === 'panel') return openPanel(interaction, client);

  if (sub === 'view') {
    const cfg  = getGuildConfig(guildId);
    const auto = getAutomodConfig(guildId);
    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Configuration — ${interaction.guild.name}`)
      .setColor(COLORS.INFO)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '📋 Logs mod',       value: cfg.modlogs_channel_id ? `<#${cfg.modlogs_channel_id}>` : '`—`', inline: true },
        { name: '👋 Bienvenue',      value: cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : '`—`', inline: true },
        { name: '🔍 Scanner VT',     value: cfg.vt_scanner ? '`✅`' : '`❌`', inline: true },
        { name: '🛡️ Anti-scam',      value: cfg.anti_scam  ? '`✅`' : '`❌`', inline: true },
        { name: '🤖 Automod',        value: auto.enabled ? `\`✅\` M:\`${auto.warn_mute_at ?? '—'}\` K:\`${auto.warn_kick_at ?? '—'}\` B:\`${auto.warn_ban_at ?? '—'}\`` : '`❌`', inline: false },
      )
      .setFooter({ text: 'Utilise /config panel pour modifier.' })
      .setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'reset') {
    const confirmId = `cfgreset_ok_${Date.now()}`;
    const cancelId  = `cfgreset_no_${Date.now()}`;
    await interaction.reply({
      content: '⚠️ **Réinitialiser TOUTE la configuration ?** (modlogs, welcome, scanner VT, anti-scam, automod). Action irréversible.',
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(confirmId).setLabel('Confirmer').setStyle(ButtonStyle.Danger).setEmoji('⚠️'),
        new ButtonBuilder().setCustomId(cancelId).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
      )],
      ephemeral: true,
    });
    const cleanup = () => {
      client.interactionHandlers.delete(confirmId);
      client.interactionHandlers.delete(cancelId);
    };
    client.interactionHandlers.set(confirmId, async btn => {
      if (btn.user.id !== interaction.user.id) return btn.reply({ content: '❌ Non autorisé.', ephemeral: true });
      cleanup();
      resetGuildConfig(guildId);
      resetAutomodConfig(guildId);
      await btn.update({ content: '✅ Configuration réinitialisée.', components: [] });
    });
    client.interactionHandlers.set(cancelId, async btn => {
      if (btn.user.id !== interaction.user.id) return btn.reply({ content: '❌ Non autorisé.', ephemeral: true });
      cleanup();
      await btn.update({ content: '❌ Réinitialisation annulée.', components: [] });
    });
    setTimeout(cleanup, 60_000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard interactif — /config panel
// ─────────────────────────────────────────────────────────────────────────────
async function openPanel(interaction, client) {
  const gid = interaction.guild.id;
  const msg = await interaction.reply({
    embeds: [buildPanelHome(interaction, gid)],
    components: buildPanelRows('home'),
    ephemeral: true,
    fetchReply: true,
  });

  const collector = msg.createMessageComponentCollector({
    filter: i => i.user.id === interaction.user.id && (i.customId.startsWith('cfgp:') || i.customId.startsWith('cfgm:')),
    time: 5 * 60_000,
  });

  collector.on('collect', async i => {
    const parts  = i.customId.split(':');
    const ns     = parts[0]; // 'cfgp' (composants panel) | 'cfgm' (modal automod)
    const action = parts[1];

    // ── Try/catch défensif : sans ça, une exception silencieuse empêche
    // i.update() d'être appelé → Discord affiche "Grook n'a pas répondu à temps"
    try {
      await handleCollect(i, ns, action, parts, gid, interaction);
    } catch (err) {
      logger.error(`[config/panel] Erreur handler bouton ${i.customId} : ${err.message}`, err.stack);
      // Best-effort : essaie d'acknowledger pour éviter le "did not respond"
      try {
        if (!i.replied && !i.deferred) {
          await i.reply({ content: `❌ Erreur : \`${err.message}\``, ephemeral: true });
        } else if (i.deferred) {
          await i.editReply({ content: `❌ Erreur : \`${err.message}\`` });
        }
      } catch { /* ignore */ }
    }
  });

  async function handleCollect(i, ns, action, parts, gid, interaction) {
    // ── Modal soumission (seuils automod) — pas atteint ici en pratique
    // (les modaux passent par interactionCreate), gardé pour compat.
    if (ns === 'cfgm' && action === 'automod' && i.isModalSubmit?.()) {
      const patch = {};
      const num = (id) => {
        const raw = i.fields.getTextInputValue(id)?.trim();
        if (raw === '' || raw === undefined) return undefined;
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
      };
      const muteAt   = num('mute_at');
      const muteDur  = num('mute_dur');
      const kickAt   = num('kick_at');
      const banAt    = num('ban_at');

      if (muteAt !== undefined)  patch.warn_mute_at       = muteAt  === 0 ? null : muteAt;
      if (muteDur !== undefined) patch.warn_mute_duration = muteDur === 0 ? null : Math.max(60, muteDur);
      if (kickAt !== undefined)  patch.warn_kick_at       = kickAt  === 0 ? null : kickAt;
      if (banAt !== undefined)   patch.warn_ban_at        = banAt   === 0 ? null : banAt;

      if (Object.keys(patch).length) setAutomodConfig(gid, patch);
      return i.update({ embeds: [buildPanelSection(interaction, gid, 'automod')], components: buildPanelRows('automod') });
    }

    if (ns !== 'cfgp') return;

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
    if (action === 'automod-thresholds') {
      const auto = getAutomodConfig(gid);
      const modal = new ModalBuilder()
        .setCustomId('cfgm:automod')
        .setTitle('Seuils automod')
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId('mute_at').setLabel('Warns avant MUTE (0 = off)').setStyle(TextInputStyle.Short)
            .setRequired(false).setPlaceholder('ex : 3').setValue(String(auto.warn_mute_at ?? ''))),
          new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId('mute_dur').setLabel('Durée du mute en secondes (min 60)').setStyle(TextInputStyle.Short)
            .setRequired(false).setPlaceholder('ex : 3600').setValue(String(auto.warn_mute_duration ?? ''))),
          new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId('kick_at').setLabel('Warns avant KICK (0 = off)').setStyle(TextInputStyle.Short)
            .setRequired(false).setPlaceholder('ex : 5').setValue(String(auto.warn_kick_at ?? ''))),
          new ActionRowBuilder().addComponents(new TextInputBuilder()
            .setCustomId('ban_at').setLabel('Warns avant BAN (0 = off)').setStyle(TextInputStyle.Short)
            .setRequired(false).setPlaceholder('ex : 7').setValue(String(auto.warn_ban_at ?? ''))),
        );
      return i.showModal(modal);
    }

    // Aucune action ne matche — log pour debug + ack quand même pour éviter timeout
    logger.warn(`[config/panel] Aucune action pour customId "${i.customId}" (parts: ${JSON.stringify(parts)})`);
    if (!i.replied && !i.deferred) await i.deferUpdate();
  }

  // Séparément : les modal submits arrivent via client.interactionHandlers,
  // pas le collector au-dessus. On enregistre 'cfgm:automod' pour rediriger.
  client.interactionHandlers.set('cfgm:automod', async (submit) => {
    if (submit.user.id !== interaction.user.id) return submit.reply({ content: '❌ Non autorisé.', ephemeral: true });
    // Rebuild un fake "collect" event manuel
    const patch = {};
    const num = (id) => {
      const raw = submit.fields.getTextInputValue(id)?.trim();
      if (raw === '' || raw === undefined) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
    };
    const muteAt  = num('mute_at');
    const muteDur = num('mute_dur');
    const kickAt  = num('kick_at');
    const banAt   = num('ban_at');
    if (muteAt !== undefined)  patch.warn_mute_at       = muteAt  === 0 ? null : muteAt;
    if (muteDur !== undefined) patch.warn_mute_duration = muteDur === 0 ? null : Math.max(60, muteDur);
    if (kickAt !== undefined)  patch.warn_kick_at       = kickAt  === 0 ? null : kickAt;
    if (banAt !== undefined)   patch.warn_ban_at        = banAt   === 0 ? null : banAt;
    if (Object.keys(patch).length) setAutomodConfig(interaction.guild.id, patch);
    await submit.update({ embeds: [buildPanelSection(interaction, interaction.guild.id, 'automod')], components: buildPanelRows('automod') });
  });

  collector.on('end', () => {
    interaction.editReply({ components: [] }).catch(() => {});
    client.interactionHandlers.delete('cfgm:automod');
  });
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
      .setDescription('Escalade auto sur seuils de warn. Bouton "Modifier seuils" pour ouvrir un formulaire.')
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
        new ButtonBuilder().setCustomId('cfgp:automod-thresholds').setLabel('Modifier seuils').setEmoji('🎯').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('cfgp:home').setLabel('Retour').setEmoji('←').setStyle(ButtonStyle.Secondary),
      ),
    ];
  }
  return buildPanelRows('home');
}
