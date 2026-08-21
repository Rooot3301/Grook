import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logChannelAction } from '../../features/modlogs.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('panic')
  .setDescription('Verrouiller tous les salons du serveur (anti-raid).')
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

  const channels = [...interaction.guild.channels.cache.values()].filter(c => c.isTextBased());
  const results  = await Promise.allSettled(channels.map(async (channel) => {
    if (mode === 'on') {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      if ('rateLimitPerUser' in channel) await channel.setRateLimitPerUser(120);
    } else {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
      if ('rateLimitPerUser' in channel) await channel.setRateLimitPerUser(0);
    }
  }));

  const ok   = results.filter(r => r.status === 'fulfilled').length;
  const fail = results.length - ok;

  if (ok === 0) {
    return interaction.editReply({ embeds: [errorEmbed(`Aucun salon modifié (${fail} échec(s)).`)] });
  }

  await logChannelAction(interaction.client, interaction.guild, {
    action: 'PANIC', channel: null, moderator: interaction.user,
    reason: `${mode.toUpperCase()} — ${reason}`,
    extra: { '📊 Salons OK': `${ok}`, ...(fail > 0 && { '⚠️ Échecs': `${fail}` }) },
  });

  const emoji = mode === 'on' ? '🚨' : '✅';
  const msg = mode === 'on'
    ? `Mode panique **activé** — ${ok} salon(s) verrouillé(s)${fail ? ` (${fail} échec(s))` : ''}.`
    : `Mode panique **désactivé** — ${ok} salon(s) restauré(s)${fail ? ` (${fail} échec(s))` : ''}.`;
  await interaction.editReply({ content: `${emoji} ${msg}` });
}
