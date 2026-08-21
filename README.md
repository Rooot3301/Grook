# Grook

Bot Discord multifonctions — **modération**, **mini-jeux** et **fun** — avec un
**dashboard web** d'administration mono-user.

Stack : discord.js v14 · Node ES modules · SQLite (better-sqlite3) · Fastify (API + WebSocket) · React + Vite + Tailwind (front).

---

## Sommaire
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Cycle de vie](#cycle-de-vie)
- [Commandes disponibles](#commandes-disponibles)
- [Dashboard web](#dashboard-web)
- [Automod](#automod)
- [Base de données](#base-de-données)
- [Arborescence](#arborescence)
- [Mise à jour](#mise-à-jour)
- [Licence](#licence)

---

## Prérequis
- **Node.js ≥ 18** (recommandé : 20 ou 22 LTS)
- Un **token de bot Discord** — [Discord Developer Portal](https://discord.com/developers/applications)
- (Optionnel) une clé API **[VirusTotal](https://www.virustotal.com/)**
- (Recommandé prod) **PM2**, `sqlite3` CLI, `build-essential` (Debian/Ubuntu)

## Installation

```bash
git clone https://github.com/Rooot3301/Grook.git
cd Grook
./grook.sh install        # ou './grook.sh install -y' pour zéro prompt
```

Le script vérifie Node/npm, installe PM2 et `build-essential` si absents (Debian/Ubuntu), crée `.env`, installe les deps du bot et du dashboard, propose un setup interactif du dashboard.

## Configuration

Tout se passe dans `.env` (voir `.env.example`). Variables clés :

| Variable | Rôle | Requis |
|---|---|---|
| `DISCORD_TOKEN` | Token du bot | ✅ |
| `BOT_OWNER_ID` | Ton ID Discord (mention `/botinfo`, accès dashboard) | recommandé |
| `DEV_GUILD_ID` | Serveur de dev pour déploiement instantané des slash commands | non |
| `VIRUSTOTAL_API_KEY` | Active le scanner de liens | non |
| `PRESENCE_INTERVAL_MIN` | Rotation du rich presence (min, défaut 5) | non |
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` (défaut `info`) | non |
| `LOG_FORMAT` | `json` pour logs structurés stdout (défaut : coloré) | non |
| `DASHBOARD_ENABLED` | `true` pour activer le dashboard web | non |
| `DASHBOARD_PORT` | Port d'écoute (défaut 3000) | non |
| `DASHBOARD_PUBLIC_URL` | URL publique du dashboard (pour le callback OAuth2) | si dashboard |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth2 Discord | si dashboard |
| `DASHBOARD_JWT_SECRET` | Secret JWT session (64 hex, `openssl rand -hex 32`) | si dashboard |

La config **par serveur** (modlogs channel, welcome, VT scanner, automod) se pilote via `/config` dans Discord ou via le dashboard.

## Cycle de vie

```bash
./grook.sh start          # PM2 si dispo, sinon bare-node
./grook.sh stop
./grook.sh restart
./grook.sh status         # état process + healthcheck + DB size + backups
./grook.sh logs [N]       # tail des N dernières lignes (défaut 100)
./grook.sh dev            # node --watch, foreground
./grook.sh backup         # snapshot atomique via sqlite3 .backup
./grook.sh update         # git fetch → backup DB → git pull → npm ci → build dashboard
                          # → restart + healthcheck (25s) + rollback auto si fail
```

## Commandes disponibles

Le bot expose **22 commandes racines** — les critiques restent directes, les autres sont regroupées en sous-commandes.

### 🛡️ Modération
`/ban [purge]` · `/kick` · `/mute <duration>` · `/unmute` · `/warn` · `/tempban <duration>` · `/unban <userid>` · `/softban` · `/clear [user]` · `/panic [mode]` · `/announce` · `/report` · `/nick [pseudo]`

**Groupe `/case`**
- `/case view <user>` — casier d'un membre (paginé)
- `/case list` — tous les cas du serveur
- `/case remove <id>` — suppression avec **autocomplete** des case IDs

**Groupe `/channel`**
- `/channel lock` · `/channel unlock` · `/channel slowmode <duree>`

### ⚙️ Configuration
`/config view` · `/config reset` · `/config modlogs set|disable` · `/config welcome set|disable` · `/config scanner enable|disable`

### 👤 Infos
- `/user info <cible>` — accepte mention ou ID (même hors serveur)
- `/user avatar [user]`
- `/user warnings <user>` — Kick Members requis
- `/user cases <user>` — View Audit Log requis
- `/server info`

### 🎮 Mini-jeux
`/game guess` · `/game typer` · `/game roulette` · `/game spy` · `/game liar` · `/game stats [user]`

### 🎭 Fun
`/fun flip` · `/fun rate <truc>` · `/fun fortune [user]` · `/fun quote <message>`
`/giveaway <lot> <duration>` · `/poll <question> <option1..4> [duree]`

### 🔧 Utilitaires
`/help` (dynamique) · `/ping` · `/botinfo` · `/afk` · `/remind <duree> <message>` · `/snipe deleted|edited`

Les permissions Discord sont attachées via `setDefaultMemberPermissions` — les membres non-modérateurs ne voient pas les commandes admin dans la palette Discord.

## Dashboard web

Activé via `DASHBOARD_ENABLED=true`. Interface mono-user (accès restreint à `BOT_OWNER_ID`), multi-guild.

### Setup OAuth2 Discord

1. Crée une application sur https://discord.com/developers/applications
2. OAuth2 → Redirects → ajoute `${DASHBOARD_PUBLIC_URL}/auth/callback`
3. Récupère `CLIENT_ID` et **Reset Secret** pour `CLIENT_SECRET`
4. Renseigne les 3 vars + `DASHBOARD_JWT_SECRET` + `BOT_OWNER_ID` dans `.env`
5. `./grook.sh restart`

Ou plus simplement : `./grook.sh install` propose un setup guidé qui écrit les valeurs dans `.env` pour toi.

### Pages

1. **Aperçu** — métriques + dernières sanctions + temp-bans à venir
2. **Modération** — casier / avertissements / temp-bans avec actions
3. **Jeux** — leaderboard + stats par jeu
4. **Fun** — giveaways passés/actifs avec force-end
5. **Configuration** — modlogs / welcome / VT scanner
6. **Automod** — seuils d'escalade configurables (désactivés par défaut)
7. **Journal live** — flux WebSocket temps réel + logs système

Endpoints publics : `GET /api/health` (healthcheck non-authentifié, exploitable par un monitoring externe).

## Automod

L'escalade automatique sur seuils de warn est **désactivée par défaut**. Configuration via `/config` ou la page dashboard "Automod" :

- `warn_mute_at` : nombre de warns avant timeout auto
- `warn_mute_duration` : durée du mute (en secondes, via dashboard en minutes)
- `warn_kick_at` : nombre de warns avant expulsion
- `warn_ban_at` : nombre de warns avant ban

Chaque seuil est indépendant et optionnel. Si l'automod est activé mais qu'un seuil n'est pas défini, cette escalade est ignorée.

## Base de données

SQLite mono-fichier (`data/grook.db`), mode **WAL**. Tables principales :

| Table | Rôle |
|---|---|
| `guild_configs` | Config par serveur |
| `automod_config` | Seuils d'escalade auto |
| `cases` | Casier (avec `guild_seq` — case IDs séquentiels atomiques) |
| `guild_counters` | Compteur atomique par guild |
| `warnings` | Historique des warns |
| `temp_bans` | Tempbans à expirer |
| `reminders` | `/remind` en attente |
| `afk_status` | Statuts AFK |
| `game_stats` | Compteurs de victoires |
| `giveaways` + `giveaway_participants` | Giveaways persistés (survivent au restart) |

Backups atomiques via `sqlite3 .backup` — `./grook.sh backup` (rotation 10 fichiers).

## Arborescence

```
Grook/
├─ grook.sh                  # CLI d'admin (install/start/stop/logs/update/backup)
├─ package.json · LICENSE · README.md · .env.example
├─ src/
│  ├─ index.js               # Entrée bot
│  ├─ version.js             # VERSION + CHANGELOG
│  ├─ loaders/               # Chargeurs commandes + events
│  ├─ commands/              # Slash commands (voir /help)
│  │  ├─ moderation/         # ban, kick, mute, warn, case, channel, ...
│  │  ├─ config/             # /config
│  │  ├─ fun/                # fun, poll, giveaway (+ impl/)
│  │  ├─ games/              # game (+ impl/)
│  │  └─ util/               # user, server, snipe, afk, remind, ... (+ impl/)
│  ├─ events/                # messageCreate, interactionCreate, ready, ...
│  ├─ features/              # modlogs, reminders, tempbans, giveaways,
│  │                         # richPresence, snipe, vtLinkScanner
│  ├─ database/
│  │  ├─ index.js            # SQLite + schéma + migrations
│  │  └─ repositories/
│  ├─ http/                  # Fastify (server, auth OAuth2, ws, routes)
│  ├─ middleware/            # Cooldowns
│  └─ utils/                 # embeds, logger, sanctions, time, pagination
├─ dashboard/                # Frontend React + Vite + Tailwind
│  ├─ package.json
│  ├─ src/                   # App.jsx, Layout, pages/
│  └─ dist/                  # (build)
└─ data/                     # SQLite (git-ignored)
```

## Mise à jour

```bash
./grook.sh update
```

Enchaîne : backup DB → `git fetch` → check ahead → `git pull --ff-only` → `npm ci` bot + dashboard → rebuild dashboard → restart PM2 → healthcheck 25s. **Rollback automatique** (`git reset --hard` sur le commit pré-update + réinstall + restart) si le bot ne remonte pas.

## Licence

MIT — © [Rooot3301](https://github.com/Rooot3301). Voir [LICENSE](./LICENSE).
