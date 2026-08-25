import { getGuildConfig } from '../database/repositories/GuildConfigRepository.js';
import { logger } from '../utils/logger.js';
import { bus } from '../http/events.js';

/**
 * Anti-scam basique — attrape les token grabbers et arnaques classiques
 * qui polluent Discord depuis 2023 (MrBeast investment, Steam gift,
 * Discord Nitro gratis, OnlyFans free, faux emplois crypto, etc.).
 *
 * Chaque catégorie a :
 *   - `label` pour le log
 *   - `urls`  : patterns d'URL malveillantes connues (regex ou substring)
 *   - `keywords` : bag of words qui déclenchent en présence D'UN LIEN
 *   - `strong` : keywords qui déclenchent SEULS (arnaque cristallisée)
 *
 * Un score de suspicion est calculé ; au-delà d'un seuil on delete + log +
 * timeout court (2h) pour couper le rôle de propagation d'un compte compromis.
 */

const SUSPECT = [
  {
    label: 'Investment scam (MrBeast / crypto / Elon)',
    urls: [
      /\b(mrbeast(-gift|-crypto|-invest|-secret)?[a-z0-9\-\.]*)\b/i,
      /\belon[a-z0-9\-\.]*(giveaway|invest|crypto)/i,
      /\b(free|claim)[-_]?bitcoin\b/i,
    ],
    keywords: ['investment', 'trading', 'profit', 'earn', 'passive income', 'crypto'],
    strong:   ['mrbeast', 'invest with me', 'guaranteed profit', 'passive income scheme'],
    weight: 3,
  },
  {
    label: 'Nitro / Discord free',
    urls: [
      /\bdiscord[-_]?nitro[-_]?(gift|free|generator|claim)/i,
      /\bd[il1]scord[a-z0-9\-\.]*\.(ru|xyz|top|gift|link)/i,
      /\bdiscordapp[a-z0-9\-\.]*\.(ru|xyz|top)/i,
    ],
    keywords: ['free nitro', 'nitro gift', 'claim your nitro'],
    strong:   ['free discord nitro', 'nitro generator', 'nitro grab'],
    weight: 3,
  },
  {
    label: 'Steam / CSGO / gaming gift',
    urls: [
      /\bst[e3]am[-_]?(gift|community|market|trade)[a-z0-9\-\.]*\.(ru|xyz|top|link|cn)/i,
      /\bs[te]am[-_]?comunity/i,
      /\bcsgo[a-z0-9\-\.]*\.(gift|top|xyz)/i,
      /\bt-trade\.[a-z]+/i,
    ],
    keywords: ['skin', 'free skin', 'gift', 'trade'],
    strong:   ['csgo skins free', 'free steam gift', 'steam gift card free'],
    weight: 2,
  },
  {
    label: 'OnlyFans / adult bait',
    urls: [
      /\bonlyfans[-_]?(free|leak|premium)[a-z0-9\-\.]*/i,
      /\b(teen|18[+])[a-z0-9\-\.]*\.(xyz|top|club)/i,
    ],
    keywords: ['nudes', 'onlyfans free'],
    strong:   ['leaked onlyfans', 'free onlyfans premium'],
    weight: 2,
  },
  {
    label: 'Job / crypto recruit scam',
    urls: [
      /\btelegra(m|ph)\.[a-z]+\/[+@]?[a-z0-9_]{5,}/i,
    ],
    keywords: ['dm me', 'work from home', 'part time', '$500 daily', 'earn 500'],
    strong:   ['dm me for job', 'crypto job opportunity', 'earn 500$ daily'],
    weight: 2,
  },
];

const URL_RE = /https?:\/\/[^\s<>()\[\]{}|^`"']+/gi;

// Cooldown par utilisateur pour éviter d'auto-punir 50 fois en 5s quand un compte
// compromis spam le même message dans plusieurs canaux.
const recentPunishments = new Map(); // userId -> ts

function matchesUrl(patterns, url) {
  for (const p of patterns) {
    if (p instanceof RegExp) { if (p.test(url)) return true; }
    else                     { if (url.toLowerCase().includes(p.toLowerCase())) return true; }
  }
  return false;
}

/**
 * Analyse un message. Renvoie { verdict: 'clean' | 'suspect' | 'block', reasons: [] }.
 */
export function analyzeMessage(message) {
  const content = message.content || '';
  const lower   = content.toLowerCase();
  const urls    = content.match(URL_RE) || [];

  const reasons = [];
  let score = 0;

  for (const cat of SUSPECT) {
    // Match strong keyword → gros signal, on ajoute même sans URL
    for (const k of cat.strong) {
      if (lower.includes(k.toLowerCase())) {
        reasons.push(`strong:${cat.label}:${k}`);
        score += cat.weight;
      }
    }
    // Match keyword secondaire ne compte QUE si un lien est présent
    if (urls.length > 0) {
      for (const k of cat.keywords) {
        if (lower.includes(k.toLowerCase())) {
          reasons.push(`keyword:${cat.label}:${k}`);
          score += 1;
        }
      }
    }
    // Match URL suspecte → très gros signal
    for (const url of urls) {
      if (matchesUrl(cat.urls, url)) {
        reasons.push(`url:${cat.label}:${url}`);
        score += cat.weight + 1;
      }
    }
  }

  // Bonus si @everyone / @here dans le contenu (typique du grabber)
  if (/@everyone|@here/.test(content) && urls.length > 0) {
    reasons.push('bonus:mass-mention-with-link');
    score += 2;
  }

  const verdict = score >= 4 ? 'block' : score >= 2 ? 'suspect' : 'clean';
  return { verdict, reasons, score };
}

/**
 * Traite un message entrant. Appelé depuis events/messageCreate.
 * N'agit que si la config anti_scan est activée pour la guild.
 */
export async function handleAntiScam(message) {
  if (message.author.bot || !message.guild) return;

  const cfg = getGuildConfig(message.guild.id);
  if (!cfg.anti_scam) return; // désactivé par défaut

  const { verdict, reasons, score } = analyzeMessage(message);
  if (verdict === 'clean') return;

  // On ne s'auto-punit qu'une fois toutes les 60s par utilisateur pour éviter
  // les cascades (compte compromis qui spam le même message dans 20 salons).
  const now  = Date.now();
  const last = recentPunishments.get(message.author.id) ?? 0;
  const alreadyPunished = now - last < 60_000;

  // Delete message dans tous les cas suspect/block
  try { await message.delete(); }
  catch (err) { logger.debug(`[antiScam] delete échoué : ${err.message}`); }

  // Log + notification
  bus.publish('antiscam:hit', message.guild.id, {
    author:  { id: message.author.id, tag: message.author.tag },
    channel: { id: message.channel.id, name: message.channel.name },
    content: message.content.slice(0, 500),
    verdict, score, reasons,
  });

  if (verdict === 'block' && !alreadyPunished) {
    recentPunishments.set(message.author.id, now);

    // Timeout 2h pour couper la propagation (compte compromis).
    try {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member?.moderatable) {
        await member.timeout(2 * 60 * 60 * 1000, `[antiScam] ${reasons.slice(0, 3).join(', ')}`);
      }
    } catch (err) {
      logger.warn(`[antiScam] timeout échoué : ${err.message}`);
    }
  }

  // Envoi dans modlogs (embed déjà géré via bus.publish)
  const channel = message.guild.channels.cache.get(cfg.modlogs_channel_id);
  if (channel?.isTextBased()) {
    try {
      await channel.send({
        content: `🛡️ **Anti-scam** — message supprimé de <@${message.author.id}>${verdict === 'block' ? ' (timeout 2h)' : ''}\n` +
                 `> Canal : <#${message.channel.id}>\n` +
                 `> Score : ${score} · ${reasons.length} signal(s)\n` +
                 `> Contenu : ${'```' + message.content.slice(0, 500).replace(/`/g, '\'') + '```'}`,
        allowedMentions: { parse: [] },
      });
    } catch { /* ignore */ }
  }
}
