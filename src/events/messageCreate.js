import { handleLinkScan } from '../features/vtLinkScanner.js';
import { tryRickroll, tryProphecy } from '../features/easterEggs.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;
    // Analyse VT (vérifie le setting par serveur en interne)
    await handleLinkScan(message);
    // Easter eggs
    await tryRickroll(message);
    await tryProphecy(message);
  },
};
