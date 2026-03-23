// Source unique de vérité pour la version du bot.
// Incrémentez VERSION à chaque release.

export const VERSION    = '2.1.1';
export const BUILD_DATE = '2026-03-23';

// Changelog compact — dernières entrées en tête
export const CHANGELOG = [
  { version: '2.1.1', date: '2026-03-23', changes: ['Menu CLI interactif (↑↓ Entrée)', 'Fix couleurs ANSI grook.sh', 'Rich presence dynamique (heure, uptime, serveurs)', '/snipe /editsnipe /afk /whois', '/giveaway /announce', 'Events messageDelete + messageUpdate'] },
  { version: '2.1.0', date: '2026-03-23', changes: ['Script CLI grook.sh', '/credit, /report, /remind', 'Temp-bans auto-expiry', 'Warn thresholds (3/5/7)', 'Pagination embeds', 'Audit log integration'] },
  { version: '2.0.0', date: '2026-03-15', changes: ['Refonte complète v1→v2', 'SQLite via better-sqlite3', 'Config par serveur', 'Repository pattern', 'Cooldowns & graceful shutdown'] },
];
