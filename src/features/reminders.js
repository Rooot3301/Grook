import { EmbedBuilder } from 'discord.js';
import { getPendingReminders, removeReminder } from '../database/repositories/ReminderRepository.js';
import { COLORS } from '../utils/embeds.js';
import { safeSetTimeout } from '../utils/time.js';
import { logger } from '../utils/logger.js';

const scheduled = new Map(); // reminderId -> handle { cancel() }

/**
 * Planifie le déclenchement d'un rappel via safeSetTimeout
 * (compatible avec les délais > 24 jours).
 */
export function scheduleReminder(client, reminder) {
  const delay = Math.max(0, reminder.fires_at * 1000 - Date.now());

  const handle = safeSetTimeout(delay, async () => {
    scheduled.delete(reminder.id);
    removeReminder(reminder.id);

    try {
      const embed = new EmbedBuilder()
        .setTitle('⏰ Rappel !')
        .setColor(COLORS.INFO)
        .setDescription(reminder.message)
        .setFooter({ text: `Rappel programmé le <t:${reminder.created_at}:F>` })
        .setTimestamp();

      const channel = client.channels.cache.get(reminder.channel_id);
      if (channel?.isTextBased()) {
        await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] });
      } else {
        const user = await client.users.fetch(reminder.user_id).catch(() => null);
        await user?.send({ embeds: [embed] });
      }
    } catch (err) {
      logger.warn(`[reminders] Envoi impossible pour ${reminder.id} : ${err.message}`);
    }
  });

  scheduled.set(reminder.id, handle);
}

/**
 * Charge et planifie tous les rappels en attente depuis la DB.
 */
export function loadPendingReminders(client) {
  const pending = getPendingReminders();
  for (const reminder of pending) scheduleReminder(client, reminder);
  if (pending.length) logger.info(`[reminders] ${pending.length} rappel(s) rechargé(s).`);
}

/**
 * Annule un rappel planifié.
 */
export function cancelReminder(id) {
  scheduled.get(id)?.cancel();
  scheduled.delete(id);
  removeReminder(id);
}
