import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { COLORS } from '../../utils/embeds.js';

// ─── Définition des easter eggs configurables ─────────────────────────────────
const EGG_META = {
  rickroll:   { col: 'egg_rickroll',   label: '🎁 Rickroll',       desc: 'Lien rickroll aléatoire (0.4% / msg)' },
  stare:      { col: 'egg_stare',      label: '👀 Regard',          desc: 'Réaction 👀 silencieuse (0.2% / msg)' },
  fake_crash: { col: 'egg_fake_crash', label: '💥 Faux crash',      desc: 'Faux embed d\'erreur critique (0.15% / msg)' },
  keywords:   { col: 'egg_keywords',   label: '💬 Mots-clés',       desc: 'Réactions à "grook", CAPS, insultes, merci, mentions' },
  nice:       { col: 'egg_nice',       label: '😏 Nice',            desc: 'Réponse si message = 69 ou 420 caractères' },
  lazy:       { col: 'egg_lazy',       label: '😴 Flemme',          desc: 'Refuse d\'exécuter une commande (3.5% / cmd)' },
};

const on  = v => v ? '`✅ Actif`'    : '`❌ Désactivé`';

export const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Configurer le comportement du bot sur ce serveur.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  // /settings view
  .addSubcommand(sub => sub
    .setName('view')
    .setDescription('Voir tous les paramètres actuels du bot.'))
  // /settings easter-eggs
  .addSubcommandGroup(grp => grp
    .setName('easter-eggs')
    .setDescription('Activer ou désactiver les easter eggs.')
    .addSubcommand(sub => sub
      .setName('toggle')
      .setDescription('Activer ou désactiver un easter egg spécifique.')
      .addStringOption(o => o
        .setName('egg')
        .setDescription('Easter egg à modifier')
        .setRequired(true)
        .addChoices(
          { name: '🎁 Rickroll (0.4% / msg)',           value: 'rickroll'   },
          { name: '👀 Regard silencieux (0.2% / msg)',  value: 'stare'      },
          { name: '💥 Faux crash (0.15% / msg)',        value: 'fake_crash' },
          { name: '💬 Mots-clés (grook, CAPS, merci…)', value: 'keywords'   },
          { name: '😏 Nice (69 / 420 chars)',            value: 'nice'       },
          { name: '😴 Flemme (3.5% / commande)',         value: 'lazy'       },
        ))
      .addStringOption(o => o
        .setName('etat')
        .setDescription('Activer ou désactiver')
        .setRequired(true)
        .addChoices(
          { name: '✅ Activer',    value: '1' },
          { name: '❌ Désactiver', value: '0' },
        )))
    .addSubcommand(sub => sub
      .setName('disable-all')
      .setDescription('Désactiver tous les easter eggs d\'un coup.'))
    .addSubcommand(sub => sub
      .setName('enable-all')
      .setDescription('Réactiver tous les easter eggs.')));

export async function execute(interaction) {
  const group   = interaction.options.getSubcommandGroup(false);
  const sub     = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const cfg     = getGuildConfig(guildId);

  // ── /settings view ────────────────────────────────────────────────────────
  if (!group && sub === 'view') {
    const embed = new EmbedBuilder()
      .setTitle(`⚙️ Paramètres — ${interaction.guild.name}`)
      .setColor(COLORS.INFO)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .addFields(
        // Config de base
        {
          name: '📋 Configuration générale',
          value: [
            `Logs de modération : ${cfg.modlogs_channel_id ? `<#${cfg.modlogs_channel_id}>` : '`Non configuré`'}`,
            `Salon de bienvenue : ${cfg.welcome_channel_id ? `<#${cfg.welcome_channel_id}>` : '`Non configuré`'}`,
            `Scanner VirusTotal : ${cfg.vt_scanner ? '`✅ Actif`' : '`❌ Désactivé`'}`,
          ].join('\n'),
          inline: false,
        },
        // Easter eggs
        {
          name: '🥚 Easter eggs',
          value: Object.values(EGG_META)
            .map(e => `${e.label} : ${on(cfg[e.col])}`)
            .join('\n'),
          inline: false,
        },
      )
      .setFooter({ text: 'Modifiez via /settings easter-eggs toggle • /config pour les salons' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ── /settings easter-eggs ─────────────────────────────────────────────────
  if (group === 'easter-eggs') {
    if (sub === 'toggle') {
      const egg   = interaction.options.getString('egg', true);
      const etat  = interaction.options.getString('etat', true);
      const meta  = EGG_META[egg];
      if (!meta) return interaction.reply({ content: '❌ Easter egg inconnu.', ephemeral: true });

      setGuildConfig(guildId, { [meta.col]: parseInt(etat) });
      const label = etat === '1' ? '✅ activé' : '❌ désactivé';
      return interaction.reply({
        content: `${meta.label} : **${label}** sur ce serveur.`,
        ephemeral: true,
      });
    }

    if (sub === 'disable-all') {
      const updates = Object.fromEntries(Object.values(EGG_META).map(e => [e.col, 0]));
      setGuildConfig(guildId, updates);
      return interaction.reply({ content: '❌ Tous les easter eggs ont été désactivés.', ephemeral: true });
    }

    if (sub === 'enable-all') {
      const updates = Object.fromEntries(Object.values(EGG_META).map(e => [e.col, 1]));
      setGuildConfig(guildId, updates);
      return interaction.reply({ content: '✅ Tous les easter eggs ont été réactivés.', ephemeral: true });
    }
  }
}
