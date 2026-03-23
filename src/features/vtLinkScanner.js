import { EmbedBuilder, Colors } from 'discord.js';
import { URL as NodeURL } from 'node:url';
import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { logger } from '../utils/logger.js';

// Cache avec TTL et limite de taille : Map<urlId, { verdict, stats, fetchedAt, finalUrl }>
const cache = new Map();
const CACHE_TTL_MS  = 6 * 60 * 60 * 1000; // 6 heures
const CACHE_MAX     = 500;

// Cooldown par salon : Map<channelId, lastScanAt>
const channelCooldowns = new Map();
const CHANNEL_COOLDOWN_MS = 5000;

// Params de tracking à supprimer des URLs
const TRACKING_PARAMS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','ref','si'];

function sanitizeUrl(raw) {
  try {
    const url = new NodeURL(raw);
    TRACKING_PARAMS.forEach(p => url.searchParams.delete(p));
    url.hash = '';
    return url.toString();
  } catch { return raw; }
}

function toBase64Url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function vtGet(path, apiKey) {
  const res = await fetch(`https://www.virustotal.com/api/v3${path}`, {
    headers: { 'x-apikey': apiKey, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`VT HTTP ${res.status}`);
  return res.json();
}

function decideVerdict(stats) {
  if (!stats) return 'UNKNOWN';
  if ((stats.malicious  || 0) > 0) return 'DANGEROUS';
  if ((stats.suspicious || 0) > 0) return 'SUSPICIOUS';
  if ((stats.harmless   || 0) > 0 || (stats.undetected || 0) > 0) return 'SAFE';
  return 'UNKNOWN';
}

function evictCache() {
  if (cache.size < CACHE_MAX) return;
  const now = Date.now();
  for (const [key, val] of cache) {
    if (now - val.fetchedAt > CACHE_TTL_MS) cache.delete(key);
  }
  // Si toujours trop grand, on vire les plus anciens
  if (cache.size >= CACHE_MAX) {
    const sorted = [...cache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
    sorted.slice(0, 50).forEach(([k]) => cache.delete(k));
  }
}

async function analyzeUrl(rawUrl) {
  const apiKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (!apiKey) return null;
  const url   = sanitizeUrl(rawUrl);
  const urlId = toBase64Url(url);
  const now   = Date.now();
  const hit   = cache.get(urlId);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) return hit;
  try {
    const report = await vtGet(`/urls/${urlId}`, apiKey);
    const stats  = report?.data?.attributes?.last_analysis_stats;
    const result = { verdict: decideVerdict(stats), stats: stats ?? {}, fetchedAt: now, finalUrl: url };
    evictCache();
    cache.set(urlId, result);
    return result;
  } catch (err) {
    logger.debug('[vtScanner] Analyse échouée :', err.message);
    return null;
  }
}

function extractUrl(text) {
  const match = /https?:\/\/[^\s<>()\[\]{}|^`"']+/i.exec(text);
  return match?.[0] ?? null;
}

/**
 * Analyse un lien présent dans un message et envoie un embed de résultat.
 * Vérifie automatiquement si le scanner est activé pour le serveur.
 * @param {import('discord.js').Message} message
 */
export async function handleLinkScan(message) {
  if (!process.env.VIRUSTOTAL_API_KEY?.trim()) return;
  if (message.author.bot || !message.guild) return;

  const config = getGuildConfig(message.guild.id);
  if (!config.vt_scanner) return;

  const url = extractUrl(message.content);
  if (!url) return;

  // Cooldown par salon
  const now = Date.now();
  if (now - (channelCooldowns.get(message.channel.id) ?? 0) < CHANNEL_COOLDOWN_MS) return;
  channelCooldowns.set(message.channel.id, now);

  const report = await analyzeUrl(url);
  if (!report) return;

  const { verdict, stats, finalUrl } = report;
  const colorMap = { DANGEROUS: Colors.Red, SUSPICIOUS: Colors.Orange, SAFE: Colors.Green, UNKNOWN: Colors.Greyple };

  const embed = new EmbedBuilder()
    .setTitle(`🔍 Analyse de lien — ${verdict}`)
    .setDescription(`[${finalUrl}](${finalUrl})`)
    .setColor(colorMap[verdict] ?? Colors.Blurple)
    .addFields(
      { name: '🔴 Malveillants', value: String(stats.malicious  ?? 0), inline: true },
      { name: '🟡 Suspects',     value: String(stats.suspicious ?? 0), inline: true },
      { name: '🟢 Inoffensifs',  value: String(stats.harmless   ?? 0), inline: true },
    )
    .setFooter({ text: 'Propulsé par VirusTotal' })
    .setTimestamp();

  // Si modlogs configuré, logguer là-bas ; sinon dans le salon courant
  const modlogsChannel = config.modlogs_channel_id
    ? message.guild.channels.cache.get(config.modlogs_channel_id)
    : null;
  const target = modlogsChannel ?? message.channel;

  try {
    await target.send({ embeds: [embed] });
  } catch (err) {
    logger.debug('[vtScanner] Envoi embed échoué :', err.message);
  }
}
