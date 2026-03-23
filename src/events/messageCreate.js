import { handleLinkScan } from '../features/vtLinkScanner.js';
import {
  tryRickroll,
  tryProphecy,
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

    // ── Scan VT ───────────────────────────────────────────────────────────────
    await handleLinkScan(message);

    // ── Mention du bot (prioritaire — pas d'autres eggs si déclenché) ─────────
    if (await tryMentionResponse(message, client.user.id)) return;

    // ── Déclencheurs par mots-clés ────────────────────────────────────────────
    if (await tryThanksReaction(message))   return;
    if (await tryGrookNameReaction(message)) return;
    if (await tryInsultReaction(message))    return;
    if (await tryCapsReaction(message))      return;
    if (await tryNiceNumber(message))        return;

    // ── Easter eggs probabilistes (un seul par message max) ───────────────────
    if (await tryRickroll(message))   return;
    if (await tryFakeCrash(message))  return;
    if (await tryProphecy(message))   return;
    await tryStare(message); // peut co-exister (juste une reaction)
  },
};
