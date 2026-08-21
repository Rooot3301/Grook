import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { execute as runDeleted } from './impl/snipe_deleted.js';
import { execute as runEdited }  from './impl/snipe_edited.js';

export const data = new SlashCommandBuilder()
  .setName('snipe')
  .setDescription('Récupérer un message récemment supprimé ou modifié dans ce salon.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand(s => s.setName('deleted').setDescription('Dernier message supprimé.'))
  .addSubcommand(s => s.setName('edited') .setDescription('Dernière modification de message.'));

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'deleted') return runDeleted(interaction);
  if (sub === 'edited')  return runEdited(interaction);
}
