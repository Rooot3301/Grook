import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import {
  snapshotChannel, getGuildSnapshots, clearGuildSnapshots,
} from '../../database/repositories/PanicRepository.js';

const PANIC_SLOWMODE_S = 120;

export const data = new SlashCommandBuilder()
  .setName('panic')
  .setDescription('Verrouiller tous les salons (anti-raid) puis restaurer l\'état exact.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o
    .setName('mode')
    .setDescription('on = verrouille tout · off = restaure (défaut : on)')
    .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' }))
  .addStringOption(o => o.setName('reason').setDescription('Raison').setMaxLength(300));

export async function execute(interaction) {
  const mode   = interaction.options.getString('mode') ?? 'on';
  const reason = interaction.options.getString('reason') || (mode === 'on' ? 'Anti-raid' : 'Fin d\'alerte');
  await interaction.deferReply();

  const everyoneId = interaction.guild.roles.everyone.id;
  const channels   = [...interaction.guild.channels.cache.values()].filter(c => c.isTextBased());

  if (mode === 'on') return panicOn(interaction, channels, everyoneId, reason);
  return panicOff(interaction, channels, everyoneId, reason);
}

/**
 * Lit l'état d'un channel : overwrite SendMessages sur @everyone + slowmode.
 * Retourne 'unset' si aucun overwrite pour SendMessages sur @everyone.
 */
function readChannelState(channel, everyoneId) {
  const overwrite = channel.permissionOverwrites.cache.get(everyoneId);
  const bit = overwrite?.deny?.has?.('SendMessages') ? 'false'
            : overwrite?.allow?.has?.('SendMessages') ? 'true'
            : 'unset';
  return {
    sendMessages: bit,
    rateLimit:    channel.rateLimitPerUser ?? 0,
  };
}

async function panicOn(interaction, channels, everyoneId, reason) {
  // Wipe l'ancien snapshot (au cas où /panic on est appelé deux fois de suite).
  clearGuildSnapshots(interaction.guild.id);

  const results = await Promise.allSettled(channels.map(async (channel) => {
    // Snapshot AVANT modification
    const state = readChannelState(channel, everyoneId);
    snapshotChannel(interaction.guild.id, channel.id, state.sendMessages, state.rateLimit);

    // Verrouillage
    await channel.permissionOverwrites.edit(everyoneId, { SendMessages: false }, { reason: `Panic: ${reason}` });
    if ('rateLimitPerUser' in channel) await channel.setRateLimitPerUser(PANIC_SLOWMODE_S, `Panic: ${reason}`);
  }));

  const ok   = results.filter(r => r.status === 'fulfilled').length;
  const fail = results.length - ok;

  if (ok === 0) {
    return interaction.editReply({ embeds: [errorEmbed(`Aucun salon modifié (${fail} échec(s)).`)] });
  }

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'PANIC', channel: null, moderator: interaction.user,
    reason: `ON — ${reason}`,
    extra: { '📊 Salons OK': `${ok}`, ...(fail > 0 && { '⚠️ Échecs': `${fail}` }), '💾 Snapshot': 'stocké' },
  });
  await interaction.editReply({ content: `🚨 Mode panique **activé** — ${ok} salon(s) verrouillé(s)${fail ? ` (${fail} échec(s))` : ''}. État avant panic sauvegardé pour restauration.` });
}

async function panicOff(interaction, channels, everyoneId, reason) {
  const snapshots = getGuildSnapshots(interaction.guild.id);
  if (!snapshots.length) {
    return interaction.editReply({
      embeds: [errorEmbed('Aucun snapshot trouvé — soit `/panic on` n\'a jamais été utilisé sur ce serveur, soit la DB a été purgée.')],
    });
  }
  const byId = new Map(snapshots.map(s => [s.channel_id, s]));

  const results = await Promise.allSettled(channels.map(async (channel) => {
    const snap = byId.get(channel.id);
    if (!snap) return; // salon créé après le /panic on — on le laisse tel quel

    // Restauration exacte de l'overwrite SendMessages
    if (snap.send_messages_overwrite === 'unset') {
      await channel.permissionOverwrites.edit(everyoneId, { SendMessages: null }, { reason: `Panic off: ${reason}` });
    } else {
      const target = snap.send_messages_overwrite === 'true';
      await channel.permissionOverwrites.edit(everyoneId, { SendMessages: target }, { reason: `Panic off: ${reason}` });
    }

    // Restauration du slowmode
    if ('rateLimitPerUser' in channel) {
      await channel.setRateLimitPerUser(snap.rate_limit_per_user, `Panic off: ${reason}`);
    }
  }));

  const ok   = results.filter(r => r.status === 'fulfilled').length;
  const fail = results.length - ok;

  clearGuildSnapshots(interaction.guild.id);

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'PANIC', channel: null, moderator: interaction.user,
    reason: `OFF — ${reason}`,
    extra: { '📊 Salons restaurés': `${ok}`, ...(fail > 0 && { '⚠️ Échecs': `${fail}` }) },
  });
  await interaction.editReply({ content: `✅ Mode panique **désactivé** — ${ok} salon(s) restauré(s) à leur état pré-panic${fail ? ` (${fail} échec(s))` : ''}.` });
}
