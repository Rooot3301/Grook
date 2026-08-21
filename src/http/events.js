import { EventEmitter } from 'node:events';

/**
 * Bus d'événements interne du bot.
 *
 * Les features du bot (modlogs, giveaways, cases, tempbans, jeux…) émettent ici.
 * Le WebSocket du dashboard s'y abonne pour pousser les events aux clients connectés.
 *
 * Format d'un événement : { type: 'case:created', guildId, data, ts }
 */
class BotEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
  }

  /**
   * Publie un événement typé sur le bus.
   * @param {string} type  Ex: 'case:created', 'tempban:expired', 'giveaway:ended'
   * @param {string|null} guildId  Guild concernée (null pour un event global)
   * @param {object} data  Payload de l'event
   */
  publish(type, guildId, data = {}) {
    const evt = { type, guildId, data, ts: Math.floor(Date.now() / 1000) };
    this.emit('event', evt);
    this.emit(type, evt);
    return evt;
  }
}

export const bus = new BotEventBus();
