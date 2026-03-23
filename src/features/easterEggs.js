import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const CONFIG = {
  rickrollChance:      0.005,
  lazyChance:          0.04,
  prophecyChance:      0.001,
  prophecyCooldownMs:  1000 * 60 * 60 * 6,
};

// Cooldown des prophéties par serveur (ephémère, Map suffit)
const lastProphecyTimes = new Map();

const LAZY_MESSAGES = [
  '😴 Laisse-moi dormir zebi…',
  'Demande à Google frère.',
  "J'ai la flemme, reviens plus tard.",
  "🥱 Pas maintenant, je suis occupé à rien faire.",
  "Tu m'as réveillé pour ça ?",
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
];

/** Tente un Rickroll sur un message (0,5% de chance). */
export async function tryRickroll(message, cfg = {}) {
  const chance = cfg.rickrollChance ?? CONFIG.rickrollChance;
  if (Math.random() >= chance) return false;
  const link = 'https://youtu.be/xvFZjo5PgG0?si=V5vVoWMNqiVBHczB';
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Récompense 🎁').setStyle(ButtonStyle.Link).setURL(link)
  );
  if (Math.random() < 0.1) {
    await message.reply({ content: "Non, pas aujourd'hui 😏" });
  } else {
    await message.reply({ content: 'GG, voilà ta récompense 🎁', components: [row] });
  }
  return true;
}

/** Répond parfois paresseusement à une commande. Retourne true si la commande doit être annulée. */
export async function tryLazyResponse(interaction, cfg = {}) {
  const chance = cfg.lazyChance ?? CONFIG.lazyChance;
  if (Math.random() >= chance) return false;
  const msg = LAZY_MESSAGES[Math.floor(Math.random() * LAZY_MESSAGES.length)];
  await interaction.reply({ content: msg, ephemeral: true }); // ← typo corrigée (ephermal → ephemeral)
  return true;
}

/** Envoie occasionnellement une prophétie mystérieuse dans un salon (0,1% / 6h par serveur). */
export async function tryProphecy(message, cfg = {}) {
  const chance   = cfg.prophecyChance      ?? CONFIG.prophecyChance;
  const cooldown = cfg.prophecyCooldownMs  ?? CONFIG.prophecyCooldownMs;
  const guildId  = message.guild?.id;
  if (!guildId) return false;
  if (Date.now() - (lastProphecyTimes.get(guildId) ?? 0) < cooldown) return false;
  if (Math.random() >= chance) return false;
  const content = PROPHECIES[Math.floor(Math.random() * PROPHECIES.length)];
  const embed = new EmbedBuilder()
    .setTitle('🔮 Prophétie de Grook')
    .setDescription(content)
    .setColor(0x8800ff)
    .setFooter({ text: 'Les étoiles sont capricieuses' })
    .setTimestamp();
  await message.channel.send({ embeds: [embed] });
  lastProphecyTimes.set(guildId, Date.now());
  return true;
}
