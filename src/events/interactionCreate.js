import { tryLazyResponse } from '../features/easterEggs.js';
import { checkCooldown, setCooldown } from '../middleware/cooldowns.js';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { logger } from '../utils/logger.js';

// Commandes pour lesquelles le lazy response ne s'applique pas (modération critique)
const NO_LAZY = new Set(['ban', 'kick', 'mute', 'unmute', 'warn', 'panic', 'clear', 'config']);

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ── Commandes slash ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Vérification du cooldown
      const { onCooldown, remaining } = checkCooldown(interaction.commandName, interaction.user.id);
      if (onCooldown) {
        return interaction.reply({
          content: `⏱️ Attends encore **${remaining}s** avant de réutiliser \`/${interaction.commandName}\`.`,
          ephemeral: true,
        });
      }

      // Easter egg paresseux (ignoré pour les commandes critiques)
      if (!NO_LAZY.has(interaction.commandName)) {
        const cfg  = interaction.guild ? getGuildConfig(interaction.guild.id) : {};
        const lazy = await tryLazyResponse(interaction, cfg);
        if (lazy) return;
      }

      // Applique le cooldown avant l'exécution
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

    // ── Boutons & modals (jeux, settings, giveaways, etc.) ────────────────────
    if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
      // Recherche exacte, puis par préfixe (pour les handlers settings_<id>_*)
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
        }
      }
    }
  },
};
