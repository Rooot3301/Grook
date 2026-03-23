import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// ─── Probabilités ─────────────────────────────────────────────────────────────
const CHANCES = {
  rickroll:    0.005,   // 0.5%  — sur chaque message
  prophecy:    0.001,   // 0.1%  — 6h cooldown par serveur
  stare:       0.003,   // 0.3%  — réaction 👀
  fakeCrash:   0.002,   // 0.2%  — faux crash embed (auto-delete 5s)
  lazy:        0.04,    // 4%    — répond fainéant à une commande
  grookName:   0.35,    // 35%   — réponse si "grook" mentionné dans le msg
  caps:        0.6,     // 60%   — réponse si message tout en MAJUSCULES (>10 chars)
  niceNumber:  1.0,     // 100%  — si le message fait exactement 69 ou 420 chars
  mention:     0.9,     // 90%   — si le bot est mentionné (laisse 10% de silence)
};

const PROPHECY_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const lastProphecyTimes    = new Map(); // guildId → timestamp

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

const PROPHECIES = [
  '🌑 Quand le centième message tombera, un modérateur trébuchera.',
  '⚡ Bientôt, un membre sera modéré par son propre mute.',
  "📜 La prophétie annonce la fin… mais pas aujourd'hui.",
  "👁️ Le serveur survivra tant que personne ne prononcera mon nom trois fois.",
  '🌊 Une vague de bans approche… ou peut-être juste une mise à jour.',
  "🎲 Le sort a été jeté. Quelqu'un va changer d'avis bientôt.",
  '🔮 Les astres indiquent une activité suspecte dans les DMs.',
  "🌀 Un silence étrange précède toujours le chaos… ou le déjeuner.",
  "🕯️ Celui qui dort le moins modère le plus.",
  "🦅 L'aigle vole haut, mais lui aussi il crash de temps en temps.",
  "☄️ Un événement sans précédent approche. C'est peut-être juste une update Discord.",
  "🐍 Méfiez-vous de celui qui ping @everyone pour rien.",
  "🌙 La nuit porte conseil. Mais aussi des messages regrettables.",
  "⚖️ La balance penche. Quelqu'un va se faire ban avant la semaine prochaine.",
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
  "🧾 Cas numéro… laisse tomber, t'as gagné mon attention.",
  "Je suis un bot. Je ne ressens rien. *pleure en binaire*",
  "Je vais faire semblant de ne pas avoir lu ça. Pour ma santé mentale.",
  "Wow. Vraiment. Wow.",
  "Ça va, j'ai une carapace. Mais quand même. C'était méchant.",
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
  "On m'a mentionné. Je suis obligé de réagir. Je le fais pas de bonne grâce.",
  "Quoi encore ?",
  "Tu as 3 secondes pour justifier ce ping.",
  "…",
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
  '```\nUnhandledPromiseRejection: Discord API returned 429 (Too Many Requests)\nRetrying in 999999ms...\n```',
  '```\nSegmentation fault (core dumped)\nprocess exited with code 139\n```',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const roll = chance => Math.random() < chance;

// ─── Easter eggs probabilistes ────────────────────────────────────────────────

/** 0.5% — Rickroll sur un message. */
export async function tryRickroll(message) {
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

/** 0.1% — Prophétie mystérieuse (cooldown 6h/serveur). */
export async function tryProphecy(message) {
  if (!roll(CHANCES.prophecy)) return false;
  const guildId = message.guild?.id;
  if (!guildId) return false;
  if (Date.now() - (lastProphecyTimes.get(guildId) ?? 0) < PROPHECY_COOLDOWN_MS) return false;
  lastProphecyTimes.set(guildId, Date.now());
  const embed = new EmbedBuilder()
    .setTitle('🔮 Prophétie de Grook')
    .setDescription(pick(PROPHECIES))
    .setColor(0x8800ff)
    .setFooter({ text: 'Les étoiles sont capricieuses' })
    .setTimestamp();
  await message.channel.send({ embeds: [embed] });
  return true;
}

/** 0.3% — Réagit au message avec 👀 sans rien dire. */
export async function tryStare(message) {
  if (!roll(CHANCES.stare)) return false;
  await message.react('👀').catch(() => {});
  return true;
}

/** 0.2% — Envoie un faux message d'erreur qui se supprime après 5s. */
export async function tryFakeCrash(message) {
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

/** 35% si "grook" est dans le message (insensible à la casse). */
export async function tryGrookNameReaction(message) {
  if (!/grook/i.test(message.content)) return false;
  if (!roll(CHANCES.grookName)) return false;
  await message.reply({ content: pick(GROOK_NAME_RESPONSES) });
  return true;
}

/** 60% si message entièrement en majuscules de plus de 10 caractères. */
export async function tryCapsReaction(message) {
  const text = message.content.trim();
  if (text.length < 10) return false;
  if (text !== text.toUpperCase() || !/[A-ZÀ-Ÿ]{5,}/.test(text)) return false;
  if (!roll(CHANCES.caps)) return false;
  await message.reply({ content: pick(CAPS_RESPONSES) });
  return true;
}

/** Insultes envers le bot (nul, inutile, débile, con, etc.). */
export async function tryInsultReaction(message) {
  const insults = /\b(nul|inutile|d[ée]bile|con(nard)?|idiot|stupide|merde|boulet|zero|zéro)\b/i;
  if (!insults.test(message.content)) return false;
  if (!roll(0.4)) return false;
  await message.reply({ content: pick(INSULT_RESPONSES) });
  return true;
}

/** Remerciements (merci grook, merci bot, etc.). */
export async function tryThanksReaction(message) {
  if (!/merci\s*(grook|bot)?/i.test(message.content)) return false;
  if (!roll(0.5)) return false;
  await message.reply({ content: pick(THANKS_RESPONSES) });
  return true;
}

/** Message de exactement 69 ou 420 caractères → "nice". */
export async function tryNiceNumber(message) {
  const len = message.content.trim().length;
  if (len !== 69 && len !== 420) return false;
  await message.reply({ content: len === 69 ? '😏 nice' : '🍃 nice' });
  return true;
}

// ─── Easter egg sur mention du bot ───────────────────────────────────────────

/** Répond quand le bot est directement mentionné (90% du temps). */
export async function tryMentionResponse(message, clientId) {
  if (!message.mentions.has(clientId)) return false;
  if (!roll(CHANCES.mention)) return false;
  const response = pick(MENTION_RESPONSES);
  // 20% de chance d'ajouter une réaction en plus de la réponse
  if (roll(0.2)) await message.react('👁️').catch(() => {});
  await message.reply({ content: response });
  return true;
}

// ─── Easter egg sur commandes (interactionCreate) ────────────────────────────

/** 4% — Grook refuse paresseusement d'exécuter une commande. */
export async function tryLazyResponse(interaction) {
  if (!roll(CHANCES.lazy)) return false;
  await interaction.reply({ content: pick(LAZY_MESSAGES), ephemeral: true });
  return true;
}
