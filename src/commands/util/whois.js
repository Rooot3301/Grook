import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('whois')
  .setDescription("Affiche les informations d'un utilisateur via son ID ou mention.")
  .addStringOption(o =>
    o.setName('cible')
     .setDescription('ID Discord ou mention (@user)')
     .setRequired(true));

export async function execute(interaction) {
    await interaction.deferReply();

    const raw = interaction.options.getString('cible').replace(/[<@!>]/g, '').trim();

    if (!/^\d{17,20}$/.test(raw)) {
      return interaction.editReply({ embeds: [errorEmbed('ID Discord invalide. Fournissez un identifiant numérique ou une mention @user.')] });
    }

    let user;
    try {
      user = await interaction.client.users.fetch(raw, { force: true });
    } catch {
      return interaction.editReply({ embeds: [errorEmbed(`Aucun utilisateur trouvé avec l'ID \`${raw}\`.`)] });
    }

    // Essai de récupération du membre dans le serveur
    let member = null;
    try {
      member = await interaction.guild.members.fetch(raw);
    } catch { /* pas dans le serveur */ }

    const created = Math.floor(user.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(member?.displayHexColor ?? COLORS.INFO)
      .setTitle(`${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 256, dynamic: true }))
      .addFields(
        { name: '🪪 ID',          value: user.id,                             inline: true },
        { name: '🤖 Bot',         value: user.bot ? 'Oui' : 'Non',           inline: true },
        { name: '📅 Compte créé', value: `<t:${created}:R>`,                 inline: true },
      );

    if (member) {
      const joined = Math.floor(member.joinedTimestamp / 1000);
      const roles  = member.roles.cache
        .filter(r => r.id !== interaction.guildId)
        .sort((a, b) => b.position - a.position)
        .map(r => `<@&${r.id}>`)
        .slice(0, 15)
        .join(' ') || '*aucun*';

      embed.addFields(
        { name: '📥 A rejoint le serveur', value: `<t:${joined}:R>`, inline: true },
        { name: `🎭 Rôles (${member.roles.cache.size - 1})`, value: roles },
      );

      if (member.nickname) {
        embed.addFields({ name: '💬 Pseudo serveur', value: member.nickname, inline: true });
      }
    } else {
      embed.setFooter({ text: '⚠️ Cet utilisateur n\'est pas dans ce serveur' });
    }

    embed.setTimestamp();
    await interaction.editReply({ embeds: [embed] });
}
