# Grook

Bot Discord multifonctions — **modération**, **mini-jeux** et **fun**.
Architecture propre (discord.js v14 + Node ES modules + SQLite via better-sqlite3),
persistance par serveur, cooldowns, arrêt gracieux et logs structurés.

---

## Sommaire
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Lancer le bot](#lancer-le-bot)
- [Commandes disponibles](#commandes-disponibles)
- [Fonctionnalités automatiques](#fonctionnalités-automatiques)
- [Arborescence](#arborescence)
- [Base de données](#base-de-données)
- [Mise à jour](#mise-à-jour)
- [Licence](#licence)

---

## Prérequis
- **Node.js ≥ 18** (recommandé : 20 LTS)
- Un **token de bot Discord** — [Discord Developer Portal](https://discord.com/developers/applications)
- (Optionnel) une clé API **[VirusTotal](https://www.virustotal.com/)** pour l'analyse des liens

## Installation
```bash
git clone https://github.com/Rooot3301/Grook.git
cd Grook
npm ci --omit=dev
cp .env.example .env
# éditer .env avec au minimum DISCORD_TOKEN
```

## Configuration
Toute la configuration passe par le fichier `.env` (voir `.env.example` pour le détail).

| Variable | Rôle | Obligatoire |
|---|---|---|
| `DISCORD_TOKEN` | Token du bot Discord | ✅ |
| `BOT_OWNER_ID` | Ton ID Discord (mention `/botinfo`, accès dashboard) | recommandé |
| `DEV_GUILD_ID` | Serveur de dev pour déploiement instantané des slash commands | non |
| `VIRUSTOTAL_API_KEY` | Clé API VirusTotal — active le scanner de liens | non |
| `PRESENCE_INTERVAL_MIN` | Rotation du rich presence (min, défaut 5) | non |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` (défaut `info`) | non |

La configuration **par serveur** (salon modlogs, salon welcome, activation du scanner VT)
se pilote depuis Discord via `/config`.

## Lancer le bot
```bash
npm start              # production
npm run dev            # dev, avec reload sur modif
```

Le script d'admin **`grook.sh`** offre un cycle de vie propre :
```bash
./grook.sh start       # lance en PM2
./grook.sh stop
./grook.sh restart
./grook.sh status
./grook.sh logs
./grook.sh update      # git pull + npm ci + backup DB + restart (avec rollback)
./grook.sh backup      # backup manuel de la DB
```

---

## Commandes disponibles

### 🛡️ Modération (`src/commands/moderation/`)
`/ban` · `/kick` · `/mute` · `/unmute` · `/warn` · `/warnings` · `/tempban` · `/unban`
`/softban` · `/clear` · `/lock` · `/unlock` · `/slowmode` · `/nick` · `/panic`
`/announce` · `/report` · `/modlogs` · `/serverinfo` · `/userinfo`
`/case` · `/cases` · `/case-remove`

- Permissions Discord natives requises (ban, kick, gérer les messages, etc.)
- Toutes les sanctions sont enregistrées dans un **casier** persistant par serveur
- Les logs partent dans le salon défini via `/config modlogs set #salon`
- **Seuils de warn** : escalade automatique à 3 / 5 / 7 avertissements
- **Tempbans** : expiration automatique en arrière-plan

### ⚙️ Configuration (`src/commands/config/`)
`/config view` · `/config reset`
`/config modlogs set|disable`
`/config welcome set|disable`
`/config scanner enable|disable`

Réservé aux membres avec la permission **Gérer le serveur**.

### 🎮 Mini-jeux (`src/commands/games/`)
| Commande | Description |
|---|---|
| `/guess` | Grook pense à un nombre entre 1 et 100 — plus haut / plus bas |
| `/typer` | Retape la phrase le plus vite possible |
| `/roulette` | Roulette russe virtuelle (élimination round par round) |
| `/spy` | Undercover : un mot différent pour l'espion, votes pour le démasquer |
| `/liar` | Deux vérités et un mensonge — vote pour deviner |

Statistiques persistées (`/grookstats` pour le leaderboard).

### 🎭 Fun (`src/commands/fun/`)
`/giveaway` · `/poll` · `/grookflip` · `/grookrate` · `/grookfortune` · `/grookquote` · `/grookstats`

Les giveaways sont **persistés en DB** et repris automatiquement au redémarrage du bot.

### 🔧 Utilitaires (`src/commands/util/`)
`/help` · `/ping` · `/botinfo` · `/avatar` · `/whois` · `/afk` · `/remind` · `/snipe` · `/editsnipe`

- `/afk` — te marque AFK, notification automatique quand quelqu'un te ping
- `/remind` — rappel personnel avec durée en langage naturel (`10m`, `2h30`, `1d`)
- `/snipe` / `/editsnipe` — dernier message supprimé / édité dans le salon

---

## Fonctionnalités automatiques

- **Modlogs** — chaque action de modération (via Grook ou l'audit log Discord) est loggée dans le salon configuré
- **Tempbans** — worker qui débannit à l'échéance
- **Reminders** — worker qui envoie les rappels à l'heure
- **Giveaways** — worker qui clôt les giveaways et tire les gagnants
- **Rich presence** — statut du bot qui tourne (nb serveurs, heure, uptime…)
- **Scanner VirusTotal** *(si `VIRUSTOTAL_API_KEY` est configuré et activé via `/config scanner enable`)* — analyse les liens postés, cache TTL, cooldown par salon
- **AFK auto-clear** — le statut AFK saute au premier message envoyé par l'utilisateur

---

## Arborescence

```
Grook/
├─ grook.sh                  # Script d'admin (start/stop/logs/update/backup)
├─ package.json
├─ .env.example
├─ src/
│  ├─ index.js               # Entrée du bot
│  ├─ version.js             # VERSION + CHANGELOG
│  ├─ loaders/               # Chargeurs de commandes et d'events
│  ├─ commands/              # Commandes slash organisées par catégorie
│  │  ├─ moderation/
│  │  ├─ config/
│  │  ├─ fun/
│  │  ├─ games/
│  │  └─ util/
│  ├─ events/                # Handlers d'events Discord
│  ├─ features/              # Modules internes (modlogs, reminders, VT, giveaways, …)
│  ├─ database/
│  │  ├─ index.js            # Ouverture SQLite + schéma + migrations
│  │  └─ repositories/       # Couche d'accès aux données (réutilisable pour le dashboard)
│  ├─ middleware/            # Cooldowns
│  └─ utils/                 # Embeds, logger, pagination, parsing de durées
└─ data/                     # DB SQLite (ignoré par git)
```

---

## Base de données

SQLite mono-fichier (`data/grook.db`), mode **WAL** activé.

| Table | Rôle |
|---|---|
| `guild_configs` | Config par serveur (modlogs, welcome, scanner VT) |
| `cases` | Casier des sanctions (ban, kick, mute, warn, softban, tempban) |
| `warnings` | Historique des warns pour les seuils d'escalade |
| `temp_bans` | File d'attente des tempbans à expirer |
| `reminders` | File d'attente des `/remind` |
| `afk_status` | Statuts AFK par serveur |
| `game_stats` | Compteurs de victoires par jeu |
| `giveaways` | Giveaways actifs et clos |

Les repositories dans `src/database/repositories/` sont conçus pour être réutilisés
directement par le futur **dashboard web d'administration**.

---

## Mise à jour

```bash
./grook.sh update
```

Enchaîne : backup de la DB → `git pull` → `npm ci --omit=dev` → migrations DB (auto au démarrage) → restart PM2. Rollback automatique si le nouveau process ne démarre pas.

---

## Licence

MIT — © Rooot3301
