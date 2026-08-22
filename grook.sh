#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  grook.sh — CLI d'administration de Grook Bot
#  Cycle de vie + logs + backup + update GitHub-linked avec rollback auto.
#  Usage : ./grook.sh <commande> [options]
#          ./grook.sh help
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_NAME="grook"
PID_FILE=".grook.pid"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/grook.log"
DB_FILE="data/grook.db"
BACKUP_DIR="backups"
BACKUP_KEEP=10
VERSION_FILE="src/version.js"
MIN_NODE_MAJOR=18
HEALTHCHECK_TIMEOUT=25

# ── Couleurs ──────────────────────────────────────────────────────────────────
R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[1;33m'; C=$'\033[0;36m'
DIM=$'\033[2m'; BOLD=$'\033[1m'; NC=$'\033[0m'

info()    { printf "${C}[i]${NC} %s\n" "$*"; }
ok()      { printf "${G}[✓]${NC} %s\n" "$*"; }
warn()    { printf "${Y}[!]${NC} %s\n" "$*"; }
err()     { printf "${R}[✗]${NC} %s\n" "$*" >&2; }
die()     { err "$*"; exit 1; }
step()    { printf "\n${BOLD}▶ %s${NC}\n" "$*"; }

# ── Helpers ───────────────────────────────────────────────────────────────────
has_pm2()         { command -v pm2 &>/dev/null; }
read_pid()        { [[ -f "$PID_FILE" ]] && cat "$PID_FILE" 2>/dev/null || echo ""; }
is_running_bare() { local p; p=$(read_pid); [[ -n "$p" ]] && kill -0 "$p" 2>/dev/null; }

get_version() {
  [[ -f "$VERSION_FILE" ]] || { echo "?"; return; }
  local v
  v=$(sed -n "s/^export const VERSION[[:space:]]*=[[:space:]]*'\([^']*\)'.*$/\1/p" "$VERSION_FILE" 2>/dev/null)
  echo "${v:-?}"
}
get_git_hash() { git rev-parse --short HEAD 2>/dev/null || echo "—"; }

pm2_status() {
  has_pm2 || { echo "no-pm2"; return; }
  pm2 jlist 2>/dev/null | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{
      try {
        const arr=JSON.parse(d||'[]');
        const p=arr.find(x=>x.name==='$APP_NAME');
        console.log(p?.pm2_env?.status||'offline');
      } catch { console.log('offline'); }
    });
  " 2>/dev/null || echo "offline"
}

wait_online() {
  local timeout="$1" waited=0
  while (( waited < timeout )); do
    if has_pm2; then
      [[ "$(pm2_status)" == "online" ]] && return 0
    else
      is_running_bare && return 0
    fi
    sleep 1
    waited=$(( waited + 1 ))
  done
  return 1
}

require_repo() {
  [[ -f "package.json" ]] || die "Lancez ce script depuis la racine du projet."
  git rev-parse --git-dir &>/dev/null || die "Ce dossier n'est pas un dépôt git."
}

# Écrit KEY=VALUE dans .env (remplace si présente, ajoute sinon).
_env_set() {
  local key="$1" value="$2"
  [[ -f .env ]] || touch .env
  local escaped; escaped=$(printf '%s\n' "$value" | sed 's/[&\\/]/\\&/g')
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" .env
  else
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

# Setup guidé du dashboard — pose les questions minimales et écrit .env.
_setup_dashboard_env() {
  echo
  step "Configuration du dashboard"
  info "Les valeurs sont écrites dans .env. Ctrl+C pour annuler."
  echo

  # BOT_OWNER_ID
  local current_owner; current_owner=$(sed -n 's/^BOT_OWNER_ID=//p' .env | head -1)
  read -r -p "  Ton ID Discord (BOT_OWNER_ID)${current_owner:+ [${current_owner}]} : " owner
  owner="${owner:-$current_owner}"
  [[ -n "$owner" ]] && _env_set BOT_OWNER_ID "$owner"

  # URL publique
  read -r -p "  URL publique du dashboard (ex : https://grook.tondomaine.tld ou http://localhost:3000) : " url
  url="${url%/}"
  [[ -n "$url" ]] && _env_set DASHBOARD_PUBLIC_URL "$url"

  # Discord App
  echo
  info "Crée une app sur https://discord.com/developers/applications"
  info "Ajoute ce redirect URI dans OAuth2 → Redirects :"
  printf "    ${C}%s/auth/callback${NC}\n" "$url"
  echo
  read -r -p "  DISCORD_CLIENT_ID : " client_id
  read -r -p "  DISCORD_CLIENT_SECRET : " client_secret
  [[ -n "$client_id" ]]     && _env_set DISCORD_CLIENT_ID "$client_id"
  [[ -n "$client_secret" ]] && _env_set DISCORD_CLIENT_SECRET "$client_secret"

  # JWT secret
  local jwt; jwt=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)
  _env_set DASHBOARD_JWT_SECRET "$jwt"
  ok "DASHBOARD_JWT_SECRET généré (64 chars hex)."

  _env_set DASHBOARD_ENABLED true
  ok "Dashboard configuré. Restart le bot pour l'activer : ./grook.sh restart"
}

# npm ci d'abord (rapide, reproductible) ; si le lock est désync, fallback sur npm install.
# À utiliser dans le dossier courant.
npm_install_deps() {
  local label="${1:-projet}"
  if npm ci --omit=dev --no-audit --no-fund 2>&1 | tee /tmp/grook_npm.log | tail -30; then
    return 0
  fi
  if grep -q "EUSAGE\|out of sync" /tmp/grook_npm.log 2>/dev/null; then
    warn "Lockfile désync pour ${label} → fallback sur npm install."
    npm install --omit=dev --no-audit --no-fund
    return $?
  fi
  return 1
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMANDES
# ══════════════════════════════════════════════════════════════════════════════

cmd_install() {
  local unattended=0
  for arg in "$@"; do
    case "$arg" in
      -y|--yes|--unattended) unattended=1 ;;
    esac
  done

  step "Prérequis"
  command -v node &>/dev/null || die "Node.js introuvable — installe Node ${MIN_NODE_MAJOR}+."
  local major; major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  (( major >= MIN_NODE_MAJOR )) || die "Node ${major} détecté — version ${MIN_NODE_MAJOR}+ requise."
  command -v npm &>/dev/null || die "npm introuvable."
  ok "Node $(node -v) · npm $(npm -v)"

  # ── Outils de build natif (nécessaires si prebuilt-install échoue) ────────
  local missing=()
  command -v make    &>/dev/null || missing+=("make")
  command -v g++     &>/dev/null || missing+=("g++")
  command -v python3 &>/dev/null || missing+=("python3")
  if (( ${#missing[@]} > 0 )); then
    warn "Outils de build manquants : ${missing[*]}"
    if command -v apt-get &>/dev/null; then
      local do_apt=0
      if (( unattended )); then do_apt=1
      else
        read -r -p "  Installer build-essential + python3 via apt maintenant ? [Y/n] " ans
        [[ -z "$ans" || "$ans" =~ ^[Yy] ]] && do_apt=1
      fi
      if (( do_apt )); then
        info "apt-get install -y build-essential python3 …"
        if apt-get update -qq && apt-get install -y build-essential python3 &>/tmp/grook_apt.log; then
          ok "Outils de build installés."
        else
          tail -20 /tmp/grook_apt.log
          die "Installation apt échouée — installe manuellement puis relance."
        fi
      else
        die "Sans les outils de build, better-sqlite3 ne compilera pas."
      fi
    elif command -v dnf &>/dev/null; then
      die "Sur RHEL/Fedora : sudo dnf groupinstall -y 'Development Tools' && sudo dnf install -y python3"
    elif command -v pacman &>/dev/null; then
      die "Sur Arch : sudo pacman -S --needed base-devel python"
    else
      die "Installe manuellement : make, g++, python3 (nécessaires pour compiler better-sqlite3)."
    fi
  else
    ok "Build tools : make · g++ · python3"
  fi

  # ── PM2 : installation auto si absent ──────────────────────────────────────
  if has_pm2; then
    ok "PM2 $(pm2 --version)"
  else
    warn "PM2 non détecté."
    local do_install=0
    if (( unattended )); then do_install=1
    else
      read -r -p "  Installer PM2 globalement maintenant ? [Y/n] " ans
      [[ -z "$ans" || "$ans" =~ ^[Yy] ]] && do_install=1
    fi
    if (( do_install )); then
      info "npm install -g pm2 …"
      if npm install -g pm2 >/dev/null 2>&1; then
        ok "PM2 $(pm2 --version) installé."
      else
        warn "Échec de l'installation globale (permissions ?). Réessaie avec : sudo npm install -g pm2"
      fi
    fi
  fi

  # ── Configuration : .env + dossiers ───────────────────────────────────────
  step "Configuration"
  if [[ -f ".env" ]]; then
    info ".env déjà présent."
  elif [[ -f ".env.example" ]]; then
    cp .env.example .env
    warn ".env créé depuis .env.example — renseigne DISCORD_TOKEN avant de démarrer."
  else
    warn ".env.example introuvable — crée .env manuellement."
  fi
  mkdir -p "$LOG_DIR" "$BACKUP_DIR" data
  ok "Dossiers : $LOG_DIR / $BACKUP_DIR / data prêts."

  # ── Dépendances du bot ─────────────────────────────────────────────────────
  step "Dépendances bot"
  npm_install_deps "bot" || die "Installation des dépendances bot échouée."
  ok "Dépendances bot installées."

  # ── Dashboard (optionnel — build si le dossier existe) ─────────────────────
  if [[ -d "dashboard" && -f "dashboard/package.json" ]]; then
    step "Dashboard web"
    (
      cd dashboard || exit 1
      if ! npm ci --no-audit --no-fund 2>&1 | tail -20; then
        warn "npm ci dashboard KO → fallback npm install."
        npm install --no-audit --no-fund || exit 1
      fi
      npm run build
    ) && ok "Dashboard buildé → dashboard/dist/" \
      || warn "Build du dashboard échoué — le bot marchera sans, tu peux relancer à la main."
  fi

  # ── Dashboard : setup guidé si non configuré ──────────────────────────────
  if [[ -f .env ]] && ! (( unattended )); then
    local dash_on; dash_on=$(sed -n 's/^DASHBOARD_ENABLED=//p' .env | head -1)
    if [[ "$dash_on" != "true" ]]; then
      echo
      read -r -p "  Configurer le dashboard web maintenant ? [y/N] " ans
      if [[ "$ans" =~ ^[Yy] ]]; then
        _setup_dashboard_env
      fi
    fi
  fi

  # ── Persistance PM2 au reboot (Linux, best-effort) ─────────────────────────
  if has_pm2 && [[ "$(uname -s)" == "Linux" ]]; then
    step "Persistance PM2 au démarrage machine"
    if pm2 startup 2>&1 | grep -q "sudo env"; then
      warn "Copie et exécute la ligne 'sudo env PATH=...' affichée ci-dessus si tu veux que PM2 relance le bot au reboot."
    else
      ok "PM2 déjà configuré au boot (ou pas besoin sur ce système)."
    fi
  fi

  echo
  ok "Installation terminée."
  echo
  printf "  ${BOLD}Prochaines étapes${NC}\n"
  printf "    ${DIM}1.${NC} Renseigne DISCORD_TOKEN (et BOT_OWNER_ID) dans .env\n"
  printf "    ${DIM}2.${NC} ${G}./grook.sh start${NC}\n"
  printf "    ${DIM}3.${NC} ${G}./grook.sh logs${NC} pour vérifier le démarrage\n"
  echo
}

cmd_start() {
  require_repo
  [[ -f ".env" ]] || die ".env introuvable — lance './grook.sh install' d'abord."
  mkdir -p "$LOG_DIR"

  if has_pm2; then
    if pm2 describe "$APP_NAME" &>/dev/null; then
      pm2 restart "$APP_NAME" --update-env >/dev/null
    else
      pm2 start src/index.js \
        --name "$APP_NAME" \
        --interpreter node \
        --log "$LOG_FILE" \
        --time \
        --restart-delay=3000 \
        --max-restarts=15 \
        --exp-backoff-restart-delay=100 >/dev/null
    fi
    pm2 save --force &>/dev/null || true
    ok "Bot démarré via PM2 (v$(get_version), $(get_git_hash))."
  else
    is_running_bare && { warn "Déjà en cours (PID $(read_pid)). Utilise restart."; return; }
    nohup node src/index.js >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    is_running_bare \
      && ok "Bot démarré bare-node (PID $(read_pid), v$(get_version))." \
      || die "Le bot a crashé au démarrage. Consulte les logs."
  fi
}

cmd_stop() {
  if has_pm2 && pm2 describe "$APP_NAME" &>/dev/null; then
    pm2 stop "$APP_NAME" >/dev/null && ok "Bot arrêté (PM2)."
  else
    local pid; pid=$(read_pid)
    [[ -z "$pid" ]] && { warn "Aucun PID enregistré — bot non démarré."; return; }
    if kill -0 "$pid" 2>/dev/null; then
      kill -SIGTERM "$pid"; sleep 2
      kill -0 "$pid" 2>/dev/null && kill -SIGKILL "$pid" || true
      rm -f "$PID_FILE"; ok "Bot arrêté (PID ${pid})."
    else
      warn "Processus ${pid} inexistant — nettoyage du PID."
      rm -f "$PID_FILE"
    fi
  fi
}

cmd_restart() {
  if has_pm2 && pm2 describe "$APP_NAME" &>/dev/null; then
    pm2 restart "$APP_NAME" --update-env >/dev/null && ok "Bot redémarré (PM2)."
  else
    cmd_stop; sleep 1; cmd_start
  fi
}

cmd_status() {
  local ver hash msg
  ver=$(get_version); hash=$(get_git_hash)
  msg=$(git log -1 --format='%s' 2>/dev/null | cut -c1-60 || echo "")

  echo ""
  printf "  ${BOLD}Grook v${ver}${NC}   ${DIM}${hash}  ${msg}${NC}\n"

  # ── Process (PM2 ou PID bare) ──────────────────────────────────────────────
  if has_pm2 && pm2 describe "$APP_NAME" &>/dev/null; then
    local st; st=$(pm2_status)
    case "$st" in
      online)  printf "  Process : ${G}● en ligne${NC} (PM2)\n" ;;
      stopped) printf "  Process : ${Y}● arrêté${NC} (PM2)\n" ;;
      *)       printf "  Process : ${R}● %s${NC} (PM2)\n" "$st" ;;
    esac
    pm2 describe "$APP_NAME" 2>/dev/null | grep -E "uptime|memory|cpu|restart" | sed 's/│//g; s/^\s*/  /' | head -6
  else
    local pid; pid=$(read_pid)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      printf "  Process : ${G}● en ligne${NC} (PID $pid, bare-node)\n"
    else
      printf "  Process : ${R}● arrêté${NC}\n"
    fi
  fi

  # ── Healthcheck via /api/health (si dashboard activé) ─────────────────────
  local dash_port; dash_port=$(sed -n "s/^DASHBOARD_PORT=//p" .env 2>/dev/null | head -1)
  local dash_on;   dash_on=$(sed -n   "s/^DASHBOARD_ENABLED=//p" .env 2>/dev/null | head -1)
  dash_port="${dash_port:-3000}"

  if [[ "$dash_on" == "true" ]] && command -v curl &>/dev/null; then
    local health; health=$(curl -sf --max-time 3 "http://localhost:${dash_port}/api/health" 2>/dev/null || echo "")
    if [[ -n "$health" ]]; then
      local discord db uptime
      discord=$(echo "$health" | sed -n 's/.*"discord":\([a-z]*\).*/\1/p')
      db=$(echo "$health"      | sed -n 's/.*"database":\([a-z]*\).*/\1/p')
      uptime=$(echo "$health"  | sed -n 's/.*"uptime":\([0-9]*\).*/\1/p')
      local dcolor dbcolor
      [[ "$discord" == "true" ]] && dcolor="$G" || dcolor="$R"
      [[ "$db" == "true" ]]      && dbcolor="$G" || dbcolor="$R"
      printf "  Discord : ${dcolor}%s${NC}\n" "$([[ "$discord" == "true" ]] && echo "● ready" || echo "● not ready")"
      printf "  DB      : ${dbcolor}%s${NC}\n" "$([[ "$db" == "true" ]] && echo "● accessible" || echo "● KO")"
      printf "  Uptime  : ${uptime}s\n"
    else
      printf "  Health  : ${Y}dashboard non joignable sur :${dash_port}${NC}\n"
    fi
  fi

  # ── Fichiers et taille DB ─────────────────────────────────────────────────
  if [[ -f "$DB_FILE" ]]; then
    printf "  DB size : $(du -h "$DB_FILE" 2>/dev/null | awk '{print $1}')\n"
  fi
  if [[ -d "$BACKUP_DIR" ]]; then
    printf "  Backups : $(ls -1 "$BACKUP_DIR"/*.db 2>/dev/null | wc -l) fichier(s), $(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')\n"
  fi

  printf "  Node    : $(node -v 2>/dev/null || echo '?')\n"
  echo ""
}

cmd_logs() {
  local lines="${1:-100}"
  if has_pm2 && pm2 describe "$APP_NAME" &>/dev/null; then
    pm2 logs "$APP_NAME" --lines "$lines"
  elif [[ -f "$LOG_FILE" ]]; then
    tail -n "$lines" -f "$LOG_FILE"
  else
    die "Aucun log trouvé (${LOG_FILE})."
  fi
}

cmd_backup() {
  local quiet="${1:-}"
  mkdir -p "$BACKUP_DIR"
  [[ -f "$DB_FILE" ]] || { [[ -z "$quiet" ]] && warn "Pas de base ($DB_FILE) — rien à sauvegarder."; return; }

  local ts dest
  ts=$(date +"%Y%m%d-%H%M%S")
  dest="${BACKUP_DIR}/grook-${ts}.db"

  # sqlite3 CLI .backup = snapshot atomique (gère le WAL correctement).
  # Fallback sur cp si sqlite3 n'est pas installé (moins fiable pendant écriture).
  if command -v sqlite3 &>/dev/null; then
    sqlite3 "$DB_FILE" ".backup '$dest'" 2>/dev/null || {
      warn "sqlite3 backup a échoué — fallback cp"
      cp "$DB_FILE" "$dest"
    }
  else
    [[ -z "$quiet" ]] && warn "sqlite3 CLI absent (apt install sqlite3) — fallback cp non atomique."
    cp "$DB_FILE" "$dest"
  fi

  # Rotation
  local count; count=$(ls -1 "${BACKUP_DIR}"/grook-*.db 2>/dev/null | wc -l)
  if (( count > BACKUP_KEEP )); then
    ls -1t "${BACKUP_DIR}"/grook-*.db | tail -n "+$(( BACKUP_KEEP + 1 ))" | xargs -r rm -f
  fi

  [[ -z "$quiet" ]] && ok "Backup DB → ${dest} ($(du -h "$dest" | awk '{print $1}'))"
  BACKUP_PATH="$dest"
}

# ─── UPDATE : GitHub-linked avec rollback auto ────────────────────────────────
cmd_update() {
  require_repo
  step "Update Grook depuis GitHub"

  local branch remote before ver_before
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  remote=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "origin/${branch}")
  before=$(git rev-parse HEAD)
  ver_before=$(get_version)
  info "Branche : ${C}${branch}${NC}  →  ${C}${remote}${NC}"
  info "HEAD actuel : ${C}$(git rev-parse --short HEAD)${NC} (v${ver_before})"

  # Working tree propre ?
  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "Modifications non commit dans le working tree. Commit ou stash avant l'update."
  fi

  step "Fetch depuis origin"
  git fetch origin "$branch" --tags
  local behind; behind=$(git rev-list "HEAD..${remote}" --count 2>/dev/null || echo 0)
  if (( behind == 0 )); then
    ok "Déjà à jour ($(get_git_hash))."
    return
  fi
  info "${behind} commit(s) en retard :"
  git log --oneline "HEAD..${remote}" | sed 's/^/    /'

  step "Backup DB pré-update"
  BACKUP_PATH=""
  cmd_backup quiet
  [[ -n "${BACKUP_PATH:-}" ]] && info "DB sauvegardée → ${BACKUP_PATH}"

  step "Pull (fast-forward)"
  if ! git pull --ff-only origin "$branch"; then
    err "git pull a échoué (probablement un conflit divergent)."
    die "Résous manuellement puis relance."
  fi
  local after ver_after
  after=$(git rev-parse HEAD)
  ver_after=$(get_version)
  ok "Nouveau HEAD : $(git rev-parse --short HEAD) (v${ver_after})"

  step "Dépendances"
  if ! npm_install_deps "bot"; then
    warn "Installation des dépendances a échoué — rollback en cours…"
    _rollback "$before" "$ver_before"
    die "Update annulé (npm)."
  fi

  # Rebuild dashboard si présent
  if [[ -d "dashboard" && -f "dashboard/package.json" ]]; then
    step "Rebuild dashboard"
    (
      cd dashboard || exit 1
      if ! npm ci --no-audit --no-fund 2>&1 | tail -10; then
        npm install --no-audit --no-fund || exit 1
      fi
      npm run build
    ) && ok "Dashboard rebuild OK." \
      || warn "Rebuild dashboard échoué — le bot continue sans."
  fi

  step "Restart et healthcheck (${HEALTHCHECK_TIMEOUT}s)"
  cmd_restart
  if wait_online "$HEALTHCHECK_TIMEOUT"; then
    ok "Bot en ligne. Update terminée : v${ver_before} → v${ver_after}"
    info "Commit : $(git rev-parse --short "$before") → $(git rev-parse --short "$after")"
    [[ -n "${BACKUP_PATH:-}" ]] && info "Backup DB : ${BACKUP_PATH}"
  else
    warn "Le bot n'est pas revenu online en ${HEALTHCHECK_TIMEOUT}s — rollback…"
    _rollback "$before" "$ver_before"
    die "Update annulé (healthcheck). Consulte les logs : ./grook.sh logs"
  fi
}

# Rollback : reset code au commit précédent + npm ci + restart.
# Ne restaure PAS la DB automatiquement (backup dispo dans $BACKUP_PATH).
_rollback() {
  local target="$1" ver="$2"
  info "Rollback → $(git rev-parse --short "$target") (v${ver})"
  git reset --hard "$target" >/dev/null 2>&1 || { err "git reset a échoué — état incohérent."; return 1; }
  npm_install_deps "rollback" >/dev/null 2>&1 || warn "Réinstall du rollback a aussi échoué — état incertain."
  cmd_restart || true
  if wait_online 15; then
    ok "Rollback OK — bot restauré à v${ver}."
  else
    err "Le bot ne redémarre pas non plus après rollback. Intervention manuelle requise."
  fi
  [[ -n "${BACKUP_PATH:-}" ]] && info "Backup DB pré-update conservé : ${BACKUP_PATH}"
}

cmd_dev() {
  [[ -f ".env" ]] || die ".env introuvable — lance './grook.sh install' d'abord."
  info "Mode dev (node --watch) — Ctrl+C pour quitter"
  node --watch src/index.js
}

# Force-re-publie les slash commands sur Discord et wipe les résidus.
# Passe par l'API /api/system/sync-commands du dashboard (auth owner via cookie
# ephemeral n'est pas possible en CLI → on utilise un token JWT signé à la volée).
# Fallback si le dashboard n'est pas activé : suggère un restart.
cmd_sync() {
  local dash_on;   dash_on=$(sed -n 's/^DASHBOARD_ENABLED=//p' .env 2>/dev/null | head -1)
  local dash_port; dash_port=$(sed -n 's/^DASHBOARD_PORT=//p' .env 2>/dev/null | head -1)
  dash_port="${dash_port:-3000}"

  if [[ "$dash_on" != "true" ]]; then
    warn "Le dashboard n'est pas activé (DASHBOARD_ENABLED != true)."
    info "Sans dashboard, un './grook.sh restart' force le re-sync au boot."
    return 1
  fi

  # Génère un JWT owner-scoped signé avec DASHBOARD_JWT_SECRET
  local secret owner
  secret=$(sed -n 's/^DASHBOARD_JWT_SECRET=//p' .env | head -1)
  owner=$(sed -n  's/^BOT_OWNER_ID=//p' .env | head -1)
  [[ -z "$secret" || -z "$owner" ]] && die "DASHBOARD_JWT_SECRET ou BOT_OWNER_ID manquant dans .env."

  local jwt
  jwt=$(node -e "
    const c = require('crypto');
    const header  = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const payload = Buffer.from(JSON.stringify({userId:'${owner}',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
    const sig     = c.createHmac('sha256','${secret}').update(\`\${header}.\${payload}\`).digest('base64url');
    process.stdout.write(\`\${header}.\${payload}.\${sig}\`);
  ")

  step "Sync commands"
  local resp; resp=$(curl -sf -X POST "http://localhost:${dash_port}/api/system/sync-commands" \
    -H "Cookie: grook_session=${jwt}" 2>&1)
  if [[ -z "$resp" ]]; then
    err "L'API n'a pas répondu. Le bot tourne bien avec le dashboard activé ?"
    return 1
  fi
  ok "Réponse : ${resp}"
}

cmd_help() {
  cat <<EOF

  ${BOLD}grook.sh${NC} — administration de Grook (v$(get_version))

  ${BOLD}Cycle de vie${NC}
    install [-y]     One-shot : PM2 auto + .env + dossiers + deps bot + build
                     dashboard + PM2 startup (-y : sans prompt)
    start            Démarre le bot (PM2 si dispo, sinon bare-node)
    stop             Arrête le bot
    restart          Redémarre
    dev              node --watch (dev, foreground)

  ${BOLD}Observation${NC}
    status           État du bot (PM2 ou PID)
    logs [N]         Tail des logs (défaut 100 lignes)

  ${BOLD}Maintenance${NC}
    backup           Sauvegarde la DB (rotation ${BACKUP_KEEP} derniers)
    update           Update depuis GitHub :
                       git fetch → backup DB → git pull --ff-only
                       → npm ci → restart → healthcheck → rollback si fail
    sync             Force la re-publication des slash commands + wipe
                       les résidus (nécessite le dashboard activé)

  ${BOLD}Divers${NC}
    help             Cette aide

  ${DIM}Le dashboard web d'administration prendra le relais pour les
  actions dépassant le cycle de vie brut.${NC}

EOF
}

# ══════════════════════════════════════════════════════════════════════════════
# DISPATCH
# ══════════════════════════════════════════════════════════════════════════════
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  install)          cmd_install "$@" ;;
  start)            cmd_start ;;
  stop)             cmd_stop ;;
  restart)          cmd_restart ;;
  status)           cmd_status ;;
  logs)             cmd_logs "${1:-100}" ;;
  backup)           cmd_backup ;;
  update)           cmd_update ;;
  dev)              cmd_dev ;;
  sync)             cmd_sync ;;
  help|--help|-h)   cmd_help ;;
  *)
    err "Commande inconnue : '${COMMAND}'"
    printf "  ./grook.sh help pour la liste.\n"
    exit 1
    ;;
esac
