import { SlashCommandBuilder, EmbedBuilder, version as djsVersion } from 'discord.js';
import { VERSION, BUILD_DATE, CHANGELOG } from '../../version.js';
import { COLORS } from '../../utils/embeds.js';

const OWNER_MENTION = process.env.BOT_OWNER_ID
  ? `<@${process.env.BOT_OWNER_ID}>`
  : '**Rooot3301**';

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h ${m % 60}min`;
  if (h > 0) return `${h}h ${m % 60}min ${s % 60}s`;
  if (m > 0) return `${m}min ${s % 60}s`;
  return `${s}s`;
}

export const data = new SlashCommandBuilder()
  .setName('botinfo')
  .setDescription('Afficher les informations, statistiques et changelog du bot.');

export async function execute(interaction) {
  const client   = interaction.client;
  const uptime   = formatUptime(client.uptime ?? 0);
  const guilds   = client.guilds.cache.size;
  const users    = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  const commands = client.commands?.size ?? 0;
  const memMB    = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const latest   = CHANGELOG[0];
  const changeList = latest?.changes.map(c => `• ${c}`).join('\n') ?? '—';

  const embed = new EmbedBuilder()
    .setTitle(`🤖 ${client.user.username}`)
    .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
    .setColor(COLORS.INFO)
    .setDescription(`Bot Discord multifonctions conçu par ${OWNER_MENTION}.\nModération · mini-jeux · fun.`)
    .addFields(
      { name: '📦 Version',      value: `\`v${VERSION}\``,          inline: true },
      { name: '📅 Build',        value: `\`${BUILD_DATE}\``,         inline: true },
      { name: '⏱️ Uptime',       value: `\`${uptime}\``,             inline: true },
      { name: '🌐 WebSocket',    value: `\`${client.ws.ping} ms\``,  inline: true },
      { name: '🖥️ RAM',          value: `\`${memMB} MB\``,           inline: true },
      { name: '🏠 Serveurs',     value: `\`${guilds}\``,             inline: true },
      { name: '👥 Utilisateurs', value: `\`${users}\``,              inline: true },
      { name: '⌨️ Commandes',    value: `\`${commands}\``,           inline: true },
      { name: '📚 discord.js',   value: `\`v${djsVersion}\``,        inline: true },
      { name: '🟢 Node.js',      value: `\`${process.version}\``,    inline: true },
      { name: `🆕 Nouveautés v${latest?.version ?? VERSION}`, value: changeList, inline: false },
    )
    .setFooter({ text: `ID : ${client.user.id}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
