import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('grookrate')
  .setDescription('Évaluer quelque chose de 0 à 10, avec le flair de Grook.')
  .addStringOption(o => o
    .setName('truc')
    .setDescription('Ce que tu veux que je note')
    .setMaxLength(100)
    .setRequired(true));

export async function execute(interaction) {
  const thing = interaction.options.getString('truc', true);
  const score = Math.floor(Math.random() * 11);
  let comment;
  if      (score === 0)  comment = `Même un bug serait plus utile que **${thing}**.`;
  else if (score <= 3)   comment = `Ouch, **${thing}** mérite un ${score}/10… courage.`;
  else if (score <= 6)   comment = `Mouais, **${thing}** obtient ${score}/10. Peut mieux faire.`;
  else if (score <= 9)   comment = `Bien ! **${thing}** vaut ${score}/10, impressionnant.`;
  else                   comment = `Parfait ! **${thing}** mérite 10/10. Est-ce sponsorisé ?`;
  await interaction.reply({ content: comment });
}
