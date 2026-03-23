// Cache en mémoire des derniers messages supprimés/édités par salon.
// Perdu au redémarrage — comportement intentionnel (données éphémères).
// TTL : 1h par entrée pour éviter une fuite mémoire sur les bots multi-serveurs.

// channelId → { content, author, attachments, timestamp }
const deletedCache = new Map();
// channelId → { before, after, author, url, timestamp }
const editedCache  = new Map();

const MAX_CONTENT = 2000;
const CACHE_TTL   = 60 * 60 * 1000; // 1 heure

function scheduleEvict(cache, key) {
  setTimeout(() => cache.delete(key), CACHE_TTL).unref();
}

export function storeDeleted(message) {
  if (!message.content && !message.attachments.size) return;
  const id = message.channel.id;
  deletedCache.set(id, {
    content:     message.content?.slice(0, MAX_CONTENT) || '',
    author:      { tag: message.author.tag, id: message.author.id, avatar: message.author.displayAvatarURL({ dynamic: true }) },
    attachments: [...message.attachments.values()].map(a => a.proxyURL),
    timestamp:   Date.now(),
  });
  scheduleEvict(deletedCache, id);
}

export function storeEdited(oldMessage, newMessage) {
  if (!oldMessage.content || oldMessage.content === newMessage.content) return;
  const id = oldMessage.channel.id;
  editedCache.set(id, {
    before:    oldMessage.content.slice(0, MAX_CONTENT),
    after:     newMessage.content.slice(0, MAX_CONTENT),
    author:    { tag: oldMessage.author.tag, id: oldMessage.author.id, avatar: oldMessage.author.displayAvatarURL({ dynamic: true }) },
    url:       newMessage.url,
    timestamp: Date.now(),
  });
  scheduleEvict(editedCache, id);
}

export function getDeleted(channelId) { return deletedCache.get(channelId) ?? null; }
export function getEdited(channelId)  { return editedCache.get(channelId)  ?? null; }
