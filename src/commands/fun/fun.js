import { SlashCommandBuilder } from 'discord.js';
import { execute as runFlip }    from './impl/flip.js';
import { execute as runRate }    from './impl/rate.js';
import { execute as runFortune } from './impl/fortune.js';
import { execute as runQuote }   from './impl/quote.js';

export const data = new SlashCommandBuilder()
  .setName('fun')
  .setDescription('Commandes légères — pile ou face, notes, prédictions, citations.')
  .addSubcommand(s => s.setName('flip').setDescription('Pile ou face (Grook peut tricher).'))
  .addSubcommand(s => s
    .setName('rate')
    .setDescription('Note quelque chose de 0 à 10.')
    .addStringOption(o => o.setName('truc').setDescription('Ce que tu veux noter').setMaxLength(100).setRequired(true)))
  .addSubcommand(s => s
    .setName('fortune')
    .setDescription('Prédiction façon cookie chinois.')
    .addUserOption(o => o.setName('user').setDescription('Membre ciblé (toi si vide)').setRequired(false)))
  .addSubcommand(s => s
    .setName('quote')
    .setDescription('Cite un message de ce serveur.')
    .addStringOption(o => o.setName('message').setDescription('Lien ou ID du message').setRequired(true)));

export async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  const handlers = { flip: runFlip, rate: runRate, fortune: runFortune, quote: runQuote };
  return handlers[sub]?.(interaction, client);
}
