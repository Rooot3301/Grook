import { SlashCommandBuilder } from 'discord.js';
import { execute as runGuess }    from './impl/guess.js';
import { execute as runTyper }    from './impl/typer.js';
import { execute as runRoulette } from './impl/roulette.js';
import { execute as runSpy }      from './impl/spy.js';
import { execute as runLiar }     from './impl/liar.js';
import { execute as runStats }    from './impl/stats.js';

export const data = new SlashCommandBuilder()
  .setName('game')
  .setDescription('Mini-jeux et statistiques de victoires.')
  .addSubcommand(s => s.setName('guess')   .setDescription('Devine le nombre auquel pense Grook (1-100).'))
  .addSubcommand(s => s.setName('typer')   .setDescription('Le premier à retaper la phrase gagne.'))
  .addSubcommand(s => s.setName('roulette').setDescription('Roulette russe virtuelle multi-joueurs.'))
  .addSubcommand(s => s.setName('spy')     .setDescription('Undercover : démasque l\'espion via votes.'))
  .addSubcommand(s => s.setName('liar')    .setDescription('Deux vérités, un mensonge — vote pour deviner.'))
  .addSubcommand(s => s
    .setName('stats')
    .setDescription('Classement des mini-jeux ou stats d\'un joueur.')
    .addUserOption(o => o.setName('user').setDescription('Voir les stats d\'un joueur').setRequired(false)));

export async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();
  const handlers = {
    guess: runGuess, typer: runTyper, roulette: runRoulette,
    spy: runSpy,     liar: runLiar,   stats: runStats,
  };
  return handlers[sub]?.(interaction, client);
}
