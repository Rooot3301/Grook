import { handleLinkScan } from '../features/vtLinkScanner.js';
import { handleAntiScam } from '../features/antiScam.js';
import { getAfk, removeAfk } from '../database/repositories/AfkRepository.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // Anti-scam : détecte + supprime les token grabbers connus (MrBeast,
    // Nitro, Steam gifts, etc.). Passe avant le scanner VT.
    await handleAntiScam(message);

    // Scan VirusTotal des liens postés
    await handleLinkScan(message);

    // Retour AFK : si l'auteur du message était marqué AFK, on le retire
    const selfAfk = getAfk(message.author.id, message.guild.id);
    if (selfAfk) {
      removeAfk(message.author.id, message.guild.id);
      message.reply({
        content: `Bienvenue de retour **${message.member?.displayName ?? message.author.username}** ! Ton statut AFK a été retiré.`,
      }).catch(() => null);
    }

    // Notification AFK : si un utilisateur AFK est mentionné
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
      }
    }
  },
};
