import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('panic')
  .setDescription('Activer ou désactiver le mode panique (anti-raid).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o
    .setName('mode')
    .setDescription('on = activer, off = désactiver (défaut : on)')
    .addChoices({ name: 'on', value: 'on' }, { name: 'off', value: 'off' })
    .setRequired(false));

export async function execute(interaction) {
  const mode = interaction.options.getString('mode') ?? 'on';
  await interaction.deferReply();

  const channels = interaction.guild.channels.cache.filter(c => c.isTextBased());
  let ok = 0, fail = 0;

  for (const channel of channels.values()) {
    try {
      if (mode === 'on') {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        if ('rateLimitPerUser' in channel) await channel.setRateLimitPerUser(120);
      } else {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        if ('rateLimitPerUser' in channel) await channel.setRateLimitPerUser(0);
      }
      ok++;
    } catch { fail++; }
  }

  const emoji  = mode === 'on' ? '🚨' : '✅';
  const action = mode === 'on'
    ? `Mode panique **activé** — ${ok} salon(s) verrouillé(s).`
    : `Mode panique **désactivé** — ${ok} salon(s) restauré(s).`;

  await interaction.editReply({ content: `${emoji} ${action}${fail > 0 ? ` (${fail} échec(s))` : ''}` });
}
