import { SlashCommandBuilder, EmbedBuilder, GuildVerificationLevel, GuildExplicitContentFilter, GuildDefaultMessageNotifications, GuildNSFWLevel } from 'discord.js';
import { COLORS } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Fiche du serveur.')
  .addSubcommand(s => s.setName('info').setDescription('Fiche complète du serveur.'));

export async function execute(interaction) {
  if (interaction.options.getSubcommand() === 'info') return serverInfo(interaction);
}

const VERIFICATION_LABELS = {
  [GuildVerificationLevel.None]:      'Aucune',
  [GuildVerificationLevel.Low]:       'Faible (email vérifié)',
  [GuildVerificationLevel.Medium]:    'Moyenne (>5 min sur Discord)',
  [GuildVerificationLevel.High]:      'Élevée (>10 min sur le serveur)',
  [GuildVerificationLevel.VeryHigh]:  'Très élevée (téléphone requis)',
};
const FILTER_LABELS = {
  [GuildExplicitContentFilter.Disabled]:            'Désactivé',
  [GuildExplicitContentFilter.MembersWithoutRoles]: 'Membres sans rôle',
  [GuildExplicitContentFilter.AllMembers]:          'Tous les membres',
};
const NOTIF_LABELS = {
  [GuildDefaultMessageNotifications.AllMessages]:  'Tous les messages',
  [GuildDefaultMessageNotifications.OnlyMentions]: 'Mentions uniquement',
};
const NSFW_LABELS = {
  [GuildNSFWLevel.Default]:       'Défaut',
  [GuildNSFWLevel.Explicit]:      'Explicite',
  [GuildNSFWLevel.Safe]:          'Safe',
  [GuildNSFWLevel.AgeRestricted]: 'Interdit -18',
};

async function serverInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { guild } = interaction;
  const owner = await guild.fetchOwner().catch(() => null);

  // Comptage humains / bots
  const members  = await guild.members.fetch().catch(() => guild.members.cache);
  const humans   = members.filter(m => !m.user.bot).size;
  const bots     = members.size - humans;
  const online   = members.filter(m => m.presence?.status && m.presence.status !== 'offline').size;

  // Comptage salons par type
  const channels = guild.channels.cache;
  const chText     = channels.filter(c => c.type === 0).size;
  const chVoice    = channels.filter(c => c.type === 2).size;
  const chCategory = channels.filter(c => c.type === 4).size;
  const chStage    = channels.filter(c => c.type === 13).size;
  const chForum    = channels.filter(c => c.type === 15).size;

  const emojis   = guild.emojis.cache;
  const emojiStatic = emojis.filter(e => !e.animated).size;
  const emojiAnim   = emojis.filter(e => e.animated).size;
  const stickers    = guild.stickers?.cache.size ?? 0;

  const features = guild.features?.length
    ? guild.features.map(f => `\`${f.toLowerCase().replace(/_/g, ' ')}\``).slice(0, 10).join(' ')
    : '`—`';

  const embed = new EmbedBuilder()
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
    .setImage(guild.bannerURL({ size: 1024 }) ?? null)
    .setColor(COLORS.INFO)
    .setDescription(guild.description || '*(pas de description)*')
    .addFields(
      { name: '🆔 ID',          value: `\`${guild.id}\``, inline: true },
      { name: '👑 Propriétaire', value: owner ? `<@${owner.id}>\n\`${owner.user.tag}\`` : '`inconnu`', inline: true },
      { name: '📅 Créé',         value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
      { name: `👥 Membres (${guild.memberCount})`, value: `Humains : \`${humans}\`\nBots : \`${bots}\`\nOnline : \`${online}\``, inline: true },
      { name: `💬 Salons (${channels.size})`,       value: `Texte : \`${chText}\`\nVoix : \`${chVoice}\`\nCatégories : \`${chCategory}\`\nStage : \`${chStage}\` · Forum : \`${chForum}\``, inline: true },
      { name: '🎭 Rôles', value: `\`${guild.roles.cache.size - 1}\``, inline: true },
      { name: '😀 Emojis', value: `Statiques : \`${emojiStatic}\`\nAnimés : \`${emojiAnim}\`\nStickers : \`${stickers}\``, inline: true },
      { name: '🚀 Boost', value: `Niveau \`${guild.premiumTier}\`\n${guild.premiumSubscriptionCount ?? 0} boost(s)`, inline: true },
      { name: '🌐 Locale', value: `\`${guild.preferredLocale}\``, inline: true },
      { name: '🔐 Vérification', value: VERIFICATION_LABELS[guild.verificationLevel] ?? '?', inline: true },
      { name: '🚫 Filtre contenu', value: FILTER_LABELS[guild.explicitContentFilter] ?? '?', inline: true },
      { name: '🔔 Notifications', value: NOTIF_LABELS[guild.defaultMessageNotifications] ?? '?', inline: true },
      { name: '🔞 NSFW', value: NSFW_LABELS[guild.nsfwLevel] ?? '?', inline: true },
      { name: '🛡️ MFA modo requis', value: guild.mfaLevel ? 'Oui' : 'Non', inline: true },
      { name: '💤 AFK', value: guild.afkChannelId ? `<#${guild.afkChannelId}> · ${Math.floor(guild.afkTimeout / 60)} min` : '`—`', inline: true },
    );

  if (guild.vanityURLCode) {
    embed.addFields({ name: '🔗 Vanity URL', value: `discord.gg/${guild.vanityURLCode}`, inline: true });
  }
  if (guild.rulesChannelId) {
    embed.addFields({ name: '📜 Règlement', value: `<#${guild.rulesChannelId}>`, inline: true });
  }
  if (guild.systemChannelId) {
    embed.addFields({ name: '💬 Canal système', value: `<#${guild.systemChannelId}>`, inline: true });
  }
  if (features !== '`—`') {
    embed.addFields({ name: '⭐ Features', value: features, inline: false });
  }

  embed.setFooter({ text: `${guild.approximatePresenceCount ?? online} en ligne actuellement` }).setTimestamp();
  await interaction.editReply({ embeds: [embed] });
}
