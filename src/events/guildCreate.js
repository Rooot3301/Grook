import { initGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { logger } from '../utils/logger.js';

export default {
  name: 'guildCreate',
  execute(guild) {
    initGuildConfig(guild.id);
    logger.info(`[guildCreate] Rejoint "${guild.name}" (${guild.id}) — ${guild.memberCount} membres`);
  },
};
