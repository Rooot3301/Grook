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

  const handle = safeSetTimeout(delay, () => {
    scheduled.delete(reminder.id);
    // Wrapper anti-unhandledRejection : sans ce .catch, une erreur du corps
    // async remonterait en top-level et tuerait le process.
    fireReminder(client, reminder).catch(err =>
      logger.warn(`[reminders] Envoi impossible pour ${reminder.id} : ${err.message}. Le rappel reste en DB.`)
    );
  });

  scheduled.set(reminder.id, handle);
}

/**
 * Envoie effectivement le rappel puis (et SEULEMENT si l'envoi a réussi)
 * retire l'entrée de la DB. En cas d'échec, la ligne persiste et sera
 * reprise au prochain démarrage via loadPendingReminders.
 */
async function fireReminder(client, reminder) {
  const embed = new EmbedBuilder()
    .setTitle('⏰ Rappel !')
    .setColor(COLORS.INFO)
    .setDescription(reminder.message)
    .setFooter({ text: `Rappel programmé le <t:${reminder.created_at}:F>` })
    .setTimestamp();

  let sent = false;
  try {
    const channel = client.channels.cache.get(reminder.channel_id);
    if (channel?.isTextBased()) {
      await channel.send({ content: `<@${reminder.user_id}>`, embeds: [embed] });
      sent = true;
    } else {
      const user = await client.users.fetch(reminder.user_id).catch(() => null);
      if (user) { await user.send({ embeds: [embed] }); sent = true; }
    }
  } catch (err) {
    logger.warn(`[reminders] Envoi impossible pour ${reminder.id} : ${err.message}. Le rappel reste en DB.`);
  }

  if (sent) removeReminder(reminder.id);
}

/** Charge et planifie tous les rappels en attente depuis la DB. */
export function loadPendingReminders(client) {
  const pending = getPendingReminders();
  for (const reminder of pending) scheduleReminder(client, reminder);
  if (pending.length) logger.info(`[reminders] ${pending.length} rappel(s) rechargé(s).`);
}

/** Annule un rappel planifié. */
export function cancelReminder(id) {
  scheduled.get(id)?.cancel();
  scheduled.delete(id);
  removeReminder(id);
}
