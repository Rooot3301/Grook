import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { COLORS, errorEmbed, successEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('announce')
  .setDescription('Envoyer une annonce stylisée dans un salon.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption(o => o
    .setName('message')
    .setDescription('Contenu de l\'annonce')
    .setRequired(true)
    .setMaxLength(4000))
  .addChannelOption(o => o
    .setName('salon')
    .setDescription('Salon cible (défaut : salon actuel)'))
  .addStringOption(o => o
    .setName('titre')
    .setDescription('Titre de l\'embed')
    .setMaxLength(256))
  .addStringOption(o => o
    .setName('couleur')
    .setDescription('Couleur hex (ex: #FF0000)')
    .setMaxLength(7))
  .addBooleanOption(o => o
    .setName('ping')
    .setDescription('Mentionner @everyone (défaut : non)'));

export async function execute(interaction) {
  const content  = interaction.options.getString('message', true);
  const channel  = interaction.options.getChannel('salon') ?? interaction.channel;
  const titre    = interaction.options.getString('titre');
  const couleur  = interaction.options.getString('couleur');
  const doPing   = interaction.options.getBoolean('ping') ?? false;

  if (!channel.isTextBased?.()) {
    return interaction.reply({ embeds: [errorEmbed('Ce salon ne supporte pas les messages.')], ephemeral: true });
  }

  // Escalade : ping:true nécessite ExplicitEveryone chez l'appelant.
  // Sinon un modo ManageMessages pourrait faire proxy d'un @everyone qu'il
  // n'aurait pas le droit d'envoyer normalement.
  if (doPing) {
    const callerPerms = channel.permissionsFor(interaction.member);
    if (!callerPerms?.has(PermissionFlagsBits.MentionEveryone)) {
      return interaction.reply({
        embeds: [errorEmbed('`ping:true` nécessite la permission **Mention @everyone** sur le salon cible.')],
        ephemeral: true,
      });
    }
  }

  let color = COLORS.INFO;
  if (couleur) {
    const parsed = parseInt(couleur.replace('#', ''), 16);
    if (!Number.isNaN(parsed)) color = parsed;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(content)
    .setTimestamp()
    .setFooter({ text: `Annonce par ${interaction.user.tag}` });
  if (titre) embed.setTitle(titre);

  try {
    await channel.send({
      content: doPing ? '@everyone' : null,
      embeds: [embed],
      allowedMentions: doPing ? { parse: ['everyone'] } : { parse: [] },
    });
  } catch (err) {
    return interaction.reply({
      embeds: [errorEmbed(`Envoi impossible : \`${err.message}\``)],
      ephemeral: true,
    });
  }

  await interaction.reply({ embeds: [successEmbed(`Annonce envoyée dans <#${channel.id}>.`)], ephemeral: true });
}
