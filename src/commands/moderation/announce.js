import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { COLORS, errorEmbed } from '../../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Envoie une annonce stylisée dans un salon.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o =>
      o.setName('message')
       .setDescription('Contenu de l\'annonce')
       .setRequired(true)
       .setMaxLength(4000))
    .addChannelOption(o =>
      o.setName('salon')
       .setDescription('Salon cible (défaut : salon actuel)'))
    .addStringOption(o =>
      o.setName('titre')
       .setDescription('Titre de l\'embed (optionnel)')
       .setMaxLength(256))
    .addStringOption(o =>
      o.setName('couleur')
       .setDescription('Couleur hex (ex: #FF0000) — défaut : blurple')
       .setMaxLength(7))
    .addBooleanOption(o =>
      o.setName('ping')
       .setDescription('Mentionner @everyone ? (défaut : non)')),

  async execute(interaction) {
    const content  = interaction.options.getString('message');
    const channel  = interaction.options.getChannel('salon') ?? interaction.channel;
    const titre    = interaction.options.getString('titre');
    const couleur  = interaction.options.getString('couleur');
    const doPing   = interaction.options.getBoolean('ping') ?? false;

    // Vérification que c'est un salon texte
    if (!channel.isTextBased?.()) {
      return interaction.reply({ embeds: [errorEmbed('Ce salon ne supporte pas les messages.')], ephemeral: true });
    }

    // Parsing couleur
    let color = COLORS.INFO;
    if (couleur) {
      const parsed = parseInt(couleur.replace('#', ''), 16);
      if (!isNaN(parsed)) color = parsed;
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

      await interaction.reply({
        content: `✅ Annonce envoyée dans <#${channel.id}>.`,
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        embeds: [errorEmbed(`Impossible d'envoyer dans ce salon : \`${err.message}\``)],
        ephemeral: true,
      });
    }
  },
};
