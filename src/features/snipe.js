// Cache en mémoire des derniers messages supprimés/édités par salon.
// Perdu au redémarrage — comportement intentionnel (données éphémères).

// channelId → { content, author, attachments, timestamp }
const deletedCache = new Map();
// channelId → { before, after, author, timestamp }
const editedCache  = new Map();

const MAX_CONTENT = 2000;

export function storeDeleted(message) {
  if (!message.content && !message.attachments.size) return;
  deletedCache.set(message.channel.id, {
    content:     message.content?.slice(0, MAX_CONTENT) || '',
    author:      { tag: message.author.tag, id: message.author.id, avatar: message.author.displayAvatarURL({ dynamic: true }) },
    attachments: [...message.attachments.values()].map(a => a.proxyURL),
    timestamp:   Date.now(),
  });
}

export function storeEdited(oldMessage, newMessage) {
  if (!oldMessage.content || oldMessage.content === newMessage.content) return;
  editedCache.set(oldMessage.channel.id, {
    before:    oldMessage.content.slice(0, MAX_CONTENT),
    after:     newMessage.content.slice(0, MAX_CONTENT),
    author:    { tag: oldMessage.author.tag, id: oldMessage.author.id, avatar: oldMessage.author.displayAvatarURL({ dynamic: true }) },
    url:       newMessage.url,
    timestamp: Date.now(),
  });
}

export function getDeleted(channelId) { return deletedCache.get(channelId) ?? null; }
export function getEdited(channelId)  { return editedCache.get(channelId)  ?? null; }
