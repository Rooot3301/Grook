export async function execute(interaction) {
  const roll = Math.random();
  let result;
  if      (roll < 0.45) result = '🟡 Pile';
  else if (roll < 0.90) result = '🔵 Face';
  else                  result = '😳 La pièce est tombée sur la tranche !';
  await interaction.reply({ content: `🪙 Résultat : **${result}**` });
}
