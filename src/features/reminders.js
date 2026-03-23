import { EmbedBuilder } from 'discord.js';
import { getPendingReminders, removeReminder } from '../database/repositories/ReminderRepository.js';
import { COLORS } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

// Map<reminderId, timeoutId>  — pour annulation si besoin
const scheduled = new Map();

/**
 * Planifie le déclenchement d'un rappel.
 * Appelé au démarrage (pour les rappels persistés) et à chaque /remind.
 */
export function scheduleReminder(client, reminder) {
  const now     = Date.now();
  const firesMs = reminder.fires_at * 1000;
  const delay   = Math.max(0, firesMs - now);

  const tid = setTimeout(async () => {
    scheduled.delete(reminder.id);
    removeReminder(reminder.id);

    try {
      const embed = new EmbedBuilder()
        .setTitle('⏰ Rappel !')
        .setColor(COLORS.INFO)
        .setDescription(reminder.message)
        .setFooter({ text: `Rappel programmé le <t:${reminder.created_at}:F>` })
        .setTimestamp();

      // Essaie d'envoyer dans le salon d'origine, sinon en DM
      const channel = client.channels.cache.get(reminder.channel_id);
      if (channel?.isTextBased()) {
        await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] });
      } else {
        const user = await client.users.fetch(reminder.user_id).catch(() => null);
        await user?.send({ embeds: [embed] });
      }
    } catch (err) {
      logger.warn(`[reminders] Impossible d'envoyer le rappel ${reminder.id} : ${err.message}`);
    }
  }, delay);

  scheduled.set(reminder.id, tid);
}

/**
 * Charge et planifie tous les rappels en attente depuis la DB.
 * À appeler une fois dans ready.js.
 */
export function loadPendingReminders(client) {
  const pending = getPendingReminders();
  for (const reminder of pending) scheduleReminder(client, reminder);
  if (pending.length) logger.info(`[reminders] ${pending.length} rappel(s) rechargé(s).`);
}

/**
 * Annule un rappel planifié (si l'utilisateur veut l'annuler via une commande future).
 */
export function cancelReminder(id) {
  const tid = scheduled.get(id);
  if (tid !== undefined) { clearTimeout(tid); scheduled.delete(id); }
  removeReminder(id);
}
