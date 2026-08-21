import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../../database/repositories/GuildConfigRepository.js';
import { COLORS, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { bus } from '../../http/events.js';

// Anti-spam simple : 1 report / user / 60s
const recentReports = new Map();
const REPORT_COOLDOWN_MS = 60_000;

export const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Signaler un utilisateur aux modérateurs (envoyé discrètement).')
  .addUserOption(o => o.setName('user').setDescription('Utilisateur à signaler').setRequired(true))
  .addStringOption(o => o.setName('reason').setDescription('Raison du signalement').setRequired(true).setMaxLength(500));

export async function execute(interaction) {
  const target = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

  if (target.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed('Tu ne peux pas te signaler toi-même.')], ephemeral: true });
  if (target.bot)                        return interaction.reply({ embeds: [errorEmbed('Tu ne peux pas signaler un bot.')], ephemeral: true });

  const last = recentReports.get(interaction.user.id) ?? 0;
  const now  = Date.now();
  if (now - last < REPORT_COOLDOWN_MS) {
    const wait = Math.ceil((REPORT_COOLDOWN_MS - (now - last)) / 1000);
    return interaction.reply({ embeds: [errorEmbed(`Attends encore ${wait}s avant un nouveau signalement.`)], ephemeral: true });
  }
  recentReports.set(interaction.user.id, now);

  const config = getGuildConfig(interaction.guild.id);
  if (!config.modlogs_channel_id) {
    return interaction.reply({
      embeds: [errorEmbed('Aucun salon de modlogs configuré. Contacte un modérateur directement.')],
      ephemeral: true,
    });
  }

  const channel = interaction.guild.channels.cache.get(config.modlogs_channel_id);
  if (!channel?.isTextBased()) {
    return interaction.reply({ embeds: [errorEmbed('Salon de modlogs introuvable.')], ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('🚨 Nouveau signalement')
    .setColor(COLORS.WARNING)
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .addFields(
      { name: '👤 Signalé',     value: `${target.tag}\n<@${target.id}>`,                     inline: true },
      { name: '📣 Par',          value: `${interaction.user.tag}\n<@${interaction.user.id}>`, inline: true },
      { name: '​',                value: '​',                                                inline: true },
      { name: '📝 Motif',        value: reason,                                                inline: false },
      { name: '📍 Salon',        value: `<#${interaction.channel.id}>`,                       inline: true },
    )
    .setTimestamp()
    .setFooter({ text: `ID cible : ${target.id}` });

  await channel.send({ embeds: [embed] });

  bus.publish('report:submitted', interaction.guild.id, {
    target:    { id: target.id, tag: target.tag },
    reporter:  { id: interaction.user.id, tag: interaction.user.tag },
    channelId: interaction.channel.id,
    reason,
  });

  await interaction.reply({
    embeds: [successEmbed('Ton signalement a été transmis aux modérateurs. Merci.')],
    ephemeral: true,
  });
}
