import { ActivityType } from 'discord.js';
import { VERSION } from '../version.js';
import { logger } from '../utils/logger.js';

// ── Types raccourcis ──────────────────────────────────────────────────────────
const P = ActivityType.Playing;
const W = ActivityType.Watching;
const L = ActivityType.Listening;
const C = ActivityType.Competing;

// ── Statuts statiques ─────────────────────────────────────────────────────────
// Textes intemporels, sans données live. Mélangés avec les dynamiques.
const STATIC = [
  { type: L, text: 'les larmes des bannis'            },
  { type: P, text: 'avec le code de prod'             },
  { type: P, text: 'Minecraft 2 (early access)'       },
  { type: P, text: 'GTA 6 bêta fermée'                },
  { type: C, text: 'au championnat du spam mondial'   },
  { type: W, text: 'les logs de modération'           },
  { type: P, text: 'à la roulette russe 🎰'           },
  { type: W, text: 'les serveurs s\'effondrer'        },
  { type: C, text: 'contre les autres bots'           },
  { type: L, text: 'Never Gonna Give You Up 🎵'       },
  { type: W, text: 'qui va se faire ban en premier'   },
  { type: P, text: 'cache-cache avec les raids'       },
  { type: L, text: 'les théories du complot'          },
  { type: C, text: 'au tournoi du silence'            },
  { type: W, text: 'Créé par Root3301'                },
];

// ── Générateurs dynamiques ────────────────────────────────────────────────────
// Chaque entrée est une fonction qui reçoit `client` et retourne { type, text }
// ou `null` si la condition n'est pas remplie (statut ignoré ce tour).
const DYNAMIC = [
  // Stats live
  c => ({ type: W, text: `${c.guilds.cache.size} serveur${c.guilds.cache.size > 1 ? 's' : ''}` }),
  c => ({ type: W, text: `${c.users.cache.size.toLocaleString('fr-FR')} utilisateurs` }),

  // Version courante
  () => ({ type: P, text: `Grook v${VERSION}` }),

  // Heure de la journée
  () => {
    const h = new Date().getHours();
    if (h >= 0  && h < 6)  return { type: W, text: 'les noctambules 🌙' };
    if (h >= 6  && h < 9)  return { type: L, text: 'le café du matin ☕' };
    if (h >= 12 && h < 14) return { type: W, text: 'la pause déjeuner 🍽️' };
    if (h >= 18 && h < 20) return { type: L, text: 'l\'apéro du soir 🍹' };
    if (h >= 22)           return { type: W, text: 'les insomniaques 🌙' };
    return null; // heures creuses → on saute
  },

  // Jour de la semaine
  () => {
    const days = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    const day  = days[new Date().getDay()];
    if (day === 'lundi')   return { type: W, text: 'le lundi de la déprime' };
    if (day === 'vendredi')return { type: C, text: 'au concours du vendredi soir' };
    if (day === 'samedi' || day === 'dimanche') return { type: P, text: `le ${day} en mode détente` };
    return null;
  },

  // Uptime du process (toutes les 5 rotations environ)
  () => {
    const s   = Math.floor(process.uptime());
    const m   = Math.floor(s / 60);
    const h   = Math.floor(m / 60);
    const d   = Math.floor(h / 24);
    let upStr;
    if (d > 0)      upStr = `${d}j ${h % 24}h en ligne`;
    else if (h > 0) upStr = `${h}h ${m % 60}min en ligne`;
    else if (m > 0) upStr = `${m}min en ligne`;
    else            return null; // trop court, pas intéressant
    return { type: W, text: upStr };
  },
];

// ── État interne ──────────────────────────────────────────────────────────────
let _index = 0;

/**
 * Construit la liste complète (statique + dynamique filtrée) et retourne
 * le statut courant, puis incrémente l'index.
 */
function nextStatus(client) {
  // Résolution des dynamiques (null = ignoré)
  const dynamic = DYNAMIC.map(fn => {
    try { return fn(client); } catch { return null; }
  }).filter(Boolean);

  const all = [...STATIC, ...dynamic];
  const status = all[_index % all.length];
  _index++;
  return status;
}

// ── Export principal ──────────────────────────────────────────────────────────
/**
 * Démarre la rotation du rich presence.
 * Intervalle : PRESENCE_INTERVAL_MIN dans .env (défaut 5 min, min 1 min).
 *
 * @param {import('discord.js').Client} client
 */
export function startRichPresenceRotation(client) {
  const intervalMin = Math.max(1, parseFloat(process.env.PRESENCE_INTERVAL_MIN) || 5);
  const intervalMs  = intervalMin * 60 * 1000;

  function rotate() {
    try {
      const status = nextStatus(client);
      client.user?.setPresence({
        activities: [{ name: status.text, type: status.type }],
        status: 'online',
      });
    } catch (err) {
      logger.warn(`[richPresence] Erreur : ${err.message}`);
    }
  }

  rotate();
  setInterval(rotate, intervalMs);

  const total = STATIC.length + DYNAMIC.length;
  logger.info(`[richPresence] Rotation active — ${total} statuts, toutes les ${intervalMin} min`);
}
