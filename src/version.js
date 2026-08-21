// Source unique de vérité pour la version du bot.
// Incrémentez VERSION à chaque release.

export const VERSION    = '2.3.0';
export const BUILD_DATE = '2026-08-21';

// Changelog compact — dernières entrées en tête
export const CHANGELOG = [
  { version: '2.3.0', date: '2026-08-21', changes: [
    'Backend dashboard web (Fastify) — API REST + WebSocket',
    'Auth OAuth2 Discord restreinte à BOT_OWNER_ID (mono-user, multi-guild)',
    'Event bus interne — les features émettent, le dashboard écoute',
    'Endpoints : cases, warnings, tempbans, giveaways, stats, config',
  ] },
  { version: '2.2.0', date: '2026-08-21', changes: [
    'Nettoyage : suppression des easter eggs (réponses auto aux messages)',
    'Fusion /credit dans /botinfo',
    'grook.sh slim + update GitHub-linked avec rollback auto',
    'Migration DB : drop des colonnes egg_*',
  ] },
  { version: '2.1.1', date: '2026-03-23', changes: ['Menu CLI interactif (↑↓ Entrée)', 'Fix couleurs ANSI grook.sh', 'Rich presence dynamique (heure, uptime, serveurs)', '/snipe /editsnipe /afk /whois', '/giveaway /announce', 'Events messageDelete + messageUpdate'] },
  { version: '2.1.0', date: '2026-03-23', changes: ['Script CLI grook.sh', '/credit, /report, /remind', 'Temp-bans auto-expiry', 'Warn thresholds (3/5/7)', 'Pagination embeds', 'Audit log integration'] },
  { version: '2.0.0', date: '2026-03-15', changes: ['Refonte complète v1→v2', 'SQLite via better-sqlite3', 'Config par serveur', 'Repository pattern', 'Cooldowns & graceful shutdown'] },
];
