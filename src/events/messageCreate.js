import { handleLinkScan } from '../features/vtLinkScanner.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import {
  tryRickroll,
  tryStare,
  tryFakeCrash,
  tryGrookNameReaction,
  tryCapsReaction,
  tryInsultReaction,
  tryThanksReaction,
  tryNiceNumber,
  tryMentionResponse,
} from '../features/easterEggs.js';

export default {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Scan VT
    await handleLinkScan(message);

    // Config du serveur (pour les toggles easter eggs)
    const cfg = getGuildConfig(message.guild.id);

    // Mention directe du bot (prioritaire)
    if (await tryMentionResponse(message, client.user.id, cfg)) return;

    // Déclencheurs mots-clés (un seul par message)
    if (await tryThanksReaction(message, cfg))    return;
    if (await tryGrookNameReaction(message, cfg)) return;
    if (await tryInsultReaction(message, cfg))    return;
    if (await tryCapsReaction(message, cfg))      return;
    if (await tryNiceNumber(message, cfg))        return;

    // Easter eggs probabilistes (un seul par message max)
    if (await tryRickroll(message, cfg))   return;
    if (await tryFakeCrash(message, cfg))  return;
    // Stare peut se cumuler (juste une réaction, peu intrusif)
    await tryStare(message, cfg);
  },
};
