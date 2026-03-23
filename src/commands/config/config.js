import {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { getGuildConfig, setGuildConfig, resetGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configurer Grook pour ce serveur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
      .setDescription('Désactiver les messages de bienvenue.')));

export async function execute(interaction, client) {
  const group   = interaction.options.getSubcommandGroup(false);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;

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
}
