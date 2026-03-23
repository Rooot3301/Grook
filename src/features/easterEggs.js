import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// ─── Probabilités ─────────────────────────────────────────────────────────────
const CHANCES = {
  rickroll:   0.004,  // 0.4%  — sur chaque message
  stare:      0.002,  // 0.2%  — réaction 👀 silencieuse
  fakeCrash:  0.0015, // 0.15% — faux crash embed (auto-delete 5s)
  lazy:       0.035,  // 3.5%  — refuse d'exécuter une commande
  grookName:  0.25,   // 25%   — si "grook" dans le message
  caps:       0.45,   // 45%   — message tout en MAJUSCULES
  insult:     0.30,   // 30%   — insulte envers le bot
  thanks:     0.35,   // 35%   — "merci grook/bot"
  mention:    0.85,   // 85%   — mention directe du bot
};

// ─── Contenu ──────────────────────────────────────────────────────────────────

const LAZY_MESSAGES = [
  '😴 Laisse-moi dormir zebi…',
  'Demande à Google frère.',
  "J'ai la flemme, reviens plus tard.",
  '🥱 Pas maintenant, je suis occupé à rien faire.',
  "Tu m'as réveillé pour ça ?",
  "Hm… non. Pas envie.",
  "J'ai calculé les risques et j'ai décidé de m'en foutre.",
  "Je suis en pause. Officiellement.",
  "🤌 Reviens me voir dans 10 ans.",
  "Erreur 418 : je suis une théière, pas un assistant.",
  "J'ai essayé. C'était trop dur. J'ai arrêté.",
  "Tu veux vraiment que je fasse ça ? … Non.",
];

const GROOK_NAME_RESPONSES = [
  "Oui c'est moi, t'as un problème ?",
  "On a parlé de moi ? 👀",
  "J'ai entendu mon nom. Je suis là. Je regarde.",
  "Grook ? C'est moi. Et alors ?",
  "Tu m'as appelé ? Non ? Dommage, je suis là quand même.",
  "Je suis partout. Je vois tout. Je suis Grook.",
  "*sort de l'ombre* … Tu disais ?",
  "Mon nom est Grook. Grook Bot. J'ai des permissions et je sais m'en servir. 🔨",
  "🫵 T'as dit quoi là ?",
];

const INSULT_RESPONSES = [
  "😒 Ah ouais ? Je vais noter ça dans mon registre.",
  "T'inquiète, j'ai noté. Le casier des utilisateurs irrespectueux est ouvert.",
  "Intéressant. Continue et je vais trouver une raison de te mute.",
  "Je suis un bot. Je ne ressens rien. *pleure en binaire*",
  "Je vais faire semblant de ne pas avoir lu ça. Pour ma santé mentale.",
  "Wow. Vraiment. Wow.",
  "🫂 On se calme. Je suis là pour toi.",
];

const THANKS_RESPONSES = [
  "De rien chef 🫡",
  "C'est mon boulot. (enfin, à moitié.)",
  "Pas de souci. Je noterai ça dans mon CV.",
  "😌 C'est pour ça que j'existe.",
  "Tu vois, des fois je sers à quelque chose.",
  "Je suis touché. Vraiment. (je suis un bot mais quand même)",
  "🥹 Personne ne me dit merci d'habitude.",
  "Avec plaisir. Reviens quand tu veux, j'ai pas de vie.",
];

const MENTION_RESPONSES = [
  "👋 Présent.",
  "Tu m'as appelé ?",
  "Oui oui, je suis là. Qu'est-ce qu'il y a ?",
  "Je dormais mais bon… qu'est-ce que tu veux ?",
  "🫡 À vos ordres.",
  "Grook écoute. Parle.",
  "Quoi encore ?",
  "Tu as 3 secondes pour justifier ce ping.",
  "👁️ Je t'observe depuis un moment déjà.",
];

const CAPS_RESPONSES = [
  "😭 POURQUOI TU CRIES",
  "ON EST BIEN OBLIGÉ DE RÉPONDRE PAREIL MAINTENANT",
  "LA TOUCHE VERR MAJ EST COINCÉE OU T'ES EN COLÈRE ?",
  "CALME TOI. S'IL TE PLAÎT.",
  "👂 J'ENTENDS BIEN SANS LES MAJUSCULES MERCI",
];

const FAKE_CRASH_MESSAGES = [
  '```\nFATAL ERROR: Cannot read properties of undefined\nReferenceError: client is not defined\n    at interactionCreate.js:42:8\n```',
  '```\nUnhandledPromiseRejection: Discord API returned 429\nRetrying in 999999ms...\n```',
  '```\nSegmentation fault (core dumped)\nprocess exited with code 139\n```',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const roll = chance => Math.random() < chance;

// ─── Easter eggs probabilistes ────────────────────────────────────────────────

/** 0.4% — Rickroll. */
export async function tryRickroll(message, cfg) {
  if (!cfg.egg_rickroll) return false;
  if (!roll(CHANCES.rickroll)) return false;
  const link = 'https://youtu.be/xvFZjo5PgG0?si=V5vVoWMNqiVBHczB';
  const row  = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Récompense 🎁').setStyle(ButtonStyle.Link).setURL(link)
  );
  if (roll(0.1)) {
    await message.reply({ content: "Non, pas aujourd'hui 😏" });
  } else {
    await message.reply({ content: 'GG, voilà ta récompense 🎁', components: [row] });
  }
  return true;
}

/** 0.2% — Réaction 👀 silencieuse. */
export async function tryStare(message, cfg) {
  if (!cfg.egg_stare) return false;
  if (!roll(CHANCES.stare)) return false;
  await message.react('👀').catch(() => {});
  return true;
}

/** 0.15% — Faux crash embed (auto-delete 5s). */
export async function tryFakeCrash(message, cfg) {
  if (!cfg.egg_fake_crash) return false;
  if (!roll(CHANCES.fakeCrash)) return false;
  const sent = await message.channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('❌ Grook Bot — Erreur critique')
        .setDescription(pick(FAKE_CRASH_MESSAGES))
        .setColor(0xFF0000)
        .setFooter({ text: 'Ne pas paniquer. Ou paniquer. Au choix.' }),
    ],
  });
  setTimeout(() => sent.delete().catch(() => {}), 5000);
  return true;
}

// ─── Easter eggs déclenchés par mots-clés ────────────────────────────────────

/** 25% si "grook" dans le message (cooldown implicite via probabilité basse). */
export async function tryGrookNameReaction(message, cfg) {
  if (!cfg.egg_keywords) return false;
  if (!/grook/i.test(message.content)) return false;
  if (!roll(CHANCES.grookName)) return false;
  await message.reply({ content: pick(GROOK_NAME_RESPONSES) });
  return true;
}

/** 45% si message tout en MAJUSCULES (>12 chars, présence de lettres). */
export async function tryCapsReaction(message, cfg) {
  if (!cfg.egg_keywords) return false;
  const text = message.content.trim();
  if (text.length < 12) return false;
  if (text !== text.toUpperCase() || !/[A-ZÀ-Ÿ]{6,}/.test(text)) return false;
  if (!roll(CHANCES.caps)) return false;
  await message.reply({ content: pick(CAPS_RESPONSES) });
  return true;
}

/** 30% si insulte détectée envers le bot. */
export async function tryInsultReaction(message, cfg) {
  if (!cfg.egg_keywords) return false;
  const insults = /\b(nul|inutile|d[ée]bile|con(nard)?|idiot|stupide|boulet)\b/i;
  if (!insults.test(message.content)) return false;
  if (!roll(CHANCES.insult)) return false;
  await message.reply({ content: pick(INSULT_RESPONSES) });
  return true;
}

/** 35% si "merci grook" ou "merci bot". */
export async function tryThanksReaction(message, cfg) {
  if (!cfg.egg_keywords) return false;
  if (!/merci\s*(grook|bot)?/i.test(message.content)) return false;
  if (!roll(CHANCES.thanks)) return false;
  await message.reply({ content: pick(THANKS_RESPONSES) });
  return true;
}

/** 100% si message = exactement 69 ou 420 caractères. */
export async function tryNiceNumber(message, cfg) {
  if (!cfg.egg_nice) return false;
  const len = message.content.trim().length;
  if (len !== 69 && len !== 420) return false;
  await message.reply({ content: len === 69 ? '😏 nice' : '🍃 nice' });
  return true;
}

/** 85% si le bot est directement mentionné. */
export async function tryMentionResponse(message, clientId, cfg) {
  if (!cfg.egg_keywords) return false;
  if (!message.mentions.has(clientId)) return false;
  if (!roll(CHANCES.mention)) return false;
  if (roll(0.2)) await message.react('👁️').catch(() => {});
  await message.reply({ content: pick(MENTION_RESPONSES) });
  return true;
}

/** 3.5% — Grook refuse paresseusement d'exécuter une commande. */
export async function tryLazyResponse(interaction, cfg) {
  if (!cfg.egg_lazy) return false;
  if (!roll(CHANCES.lazy)) return false;
  await interaction.reply({ content: pick(LAZY_MESSAGES), ephemeral: true });
  return true;
}
