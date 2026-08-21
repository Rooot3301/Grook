import { checkCooldown, setCooldown } from '../middleware/cooldowns.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ── Commandes slash ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const { onCooldown, remaining } = checkCooldown(interaction.commandName, interaction.user.id);
      if (onCooldown) {
        return interaction.reply({
          content: `⏱️ Attends encore **${remaining}s** avant de réutiliser \`/${interaction.commandName}\`.`,
          ephemeral: true,
        });
      }

      setCooldown(interaction.commandName, interaction.user.id);

      try {
        await command.execute(interaction, client);
      } catch (err) {
        logger.error(`[interaction] Erreur /${interaction.commandName} :`, err);
        const content = '❌ Une erreur est survenue lors de l\'exécution de la commande.';
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content, ephemeral: true });
          } else {
            await interaction.reply({ content, ephemeral: true });
          }
        } catch { /* ignore */ }
      }
    }

    // ── Boutons & modals (jeux, giveaways, /config reset, etc.) ──────────────
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      let handler = client.interactionHandlers?.get(interaction.customId);
      if (!handler && client.interactionHandlers) {
        for (const [key, fn] of client.interactionHandlers) {
          if (interaction.customId.startsWith(key)) {
            handler = fn;
            break;
          }
        }
      }
      if (handler) {
        try {
          await handler(interaction, client);
        } catch (err) {
          logger.error('[interaction] Erreur dans un handler :', err.message);
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true });
            } else if (interaction.deferred) {
              await interaction.editReply({ content: '❌ Une erreur est survenue.' });
            }
          } catch { /* ignoré */ }
        }
      }
    }
  },
};
