import { handleLinkScan } from '../features/vtLinkScanner.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { getAfk, removeAfk } from '../database/repositories/AfkRepository.js';
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

    // ── Retour AFK : si l'auteur du message est marqué AFK, on le retire ────
    const selfAfk = getAfk(message.author.id, message.guild.id);
    if (selfAfk) {
      removeAfk(message.author.id, message.guild.id);
      message.reply({
        content: `Bienvenue de retour **${message.member?.displayName ?? message.author.username}** ! Ton statut AFK a été retiré.`,
      }).catch(() => null);
    }

    // ── Notification AFK : si un utilisateur AFK est mentionné ──────────────
    if (message.mentions.users.size) {
      const afkNotices = [];
      for (const [, user] of message.mentions.users) {
        if (user.bot || user.id === message.author.id) continue;
        const afkData = getAfk(user.id, message.guild.id);
        if (afkData) {
          const since = Math.floor(afkData.set_at ?? (Date.now() / 1000));
          afkNotices.push(`💤 **${user.tag}** est AFK depuis <t:${since}:R> — *${afkData.reason}*`);
        }
      }
      if (afkNotices.length) {
        message.reply({ content: afkNotices.join('\n') }).catch(() => null);
        return; // on ne déclenche pas les easter eggs pour ce message
      }
    }

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
