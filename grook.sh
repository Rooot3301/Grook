#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  grook.sh — CLI de gestion de Grook Bot
#  Usage : ./grook.sh <commande>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Couleurs ANSI ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Constantes ────────────────────────────────────────────────────────────────
APP_NAME="grook-bot"
PID_FILE=".grook.pid"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/grook.log"
DB_FILE="data/grook.db"
BACKUP_DIR="backups"
MIN_NODE_MAJOR=18
VERSION_FILE="src/version.js"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*" >&2; }
die()     { error "$*"; exit 1; }

banner() {
  echo -e "${BOLD}${BLUE}"
  echo "  ██████╗ ██████╗  ██████╗  ██████╗ ██╗  ██╗"
  echo "  ██╔════╝ ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝"
  echo "  ██║  ███╗██████╔╝██║   ██║██║   ██║█████╔╝ "
  echo "  ██║   ██║██╔══██╗██║   ██║██║   ██║██╔═██╗ "
  echo "  ╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝██║  ██╗"
  echo "   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝"
  echo -e "${NC}"
  # Lire la version depuis src/version.js si dispo
  if [[ -f "$VERSION_FILE" ]]; then
    local ver
    ver=$(grep -oP "(?<=VERSION = ')[^']+" "$VERSION_FILE" 2>/dev/null || echo "?")
    echo -e "  ${BOLD}Grook Bot v${ver}${NC} — CLI de gestion\n"
  fi
}

# Vérifie si PM2 est disponible
has_pm2() { command -v pm2 &>/dev/null; }

# Lit le PID depuis le fichier (mode sans PM2)
read_pid() {
  [[ -f "$PID_FILE" ]] && cat "$PID_FILE" || echo ""
}

# Vérifie si le processus bare-node tourne
is_running_bare() {
  local pid; pid=$(read_pid)
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# ── check_requirements ────────────────────────────────────────────────────────
check_requirements() {
  command -v node &>/dev/null || die "Node.js introuvable. Installez Node ${MIN_NODE_MAJOR}+ : https://nodejs.org"
  local major; major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  (( major >= MIN_NODE_MAJOR )) || die "Node.js ${major} détecté — version ${MIN_NODE_MAJOR}+ requise."
  command -v npm  &>/dev/null || die "npm introuvable."
  [[ -f "package.json" ]] || die "package.json introuvable. Lancez ce script depuis la racine du projet."
}

# ── install ───────────────────────────────────────────────────────────────────
cmd_install() {
  banner
  info "Vérification des prérequis…"
  check_requirements
  success "Node $(node -v) / npm $(npm -v)"

  # .env
  if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
      cp ".env.example" ".env"
      warn "Fichier .env créé depuis .env.example — pensez à renseigner DISCORD_TOKEN !"
    else
      warn "Aucun .env trouvé. Créez-le manuellement."
    fi
  else
    info ".env déjà présent."
  fi

  # Dossiers nécessaires
  mkdir -p data logs backups

  info "Installation des dépendances npm…"
  npm ci --omit=dev 2>&1 | tail -5
  success "Dépendances installées."

  if has_pm2; then
    success "PM2 détecté — vous pouvez utiliser './grook.sh start' pour démarrer avec PM2."
  else
    warn "PM2 non détecté. Le bot sera lancé en mode bare-node (logs → ${LOG_FILE})."
    warn "Pour une gestion de processus avancée : npm install -g pm2"
  fi

  success "Installation terminée ! Éditez .env puis lancez : ./grook.sh start"
}

# ── start ─────────────────────────────────────────────────────────────────────
cmd_start() {
  check_requirements
  [[ -f ".env" ]] || die "Fichier .env introuvable. Lancez d'abord : ./grook.sh install"

  if has_pm2; then
    info "Démarrage avec PM2…"
    if pm2 describe "$APP_NAME" &>/dev/null; then
      pm2 restart "$APP_NAME"
    else
      pm2 start src/index.js \
        --name "$APP_NAME" \
        --interpreter node \
        --log "$LOG_FILE" \
        --time \
        --restart-delay=5000 \
        --max-restarts=10
    fi
    pm2 save --force &>/dev/null
    success "Bot démarré via PM2. Logs : ./grook.sh logs"
  else
    # Mode bare-node
    if is_running_bare; then
      warn "Le bot tourne déjà (PID $(read_pid)). Utilisez './grook.sh restart'."
      return
    fi
    mkdir -p "$LOG_DIR"
    info "Démarrage bare-node (logs → ${LOG_FILE})…"
    nohup node src/index.js >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if is_running_bare; then
      success "Bot démarré (PID $(read_pid))."
    else
      die "Le bot a planté au démarrage. Consultez : ./grook.sh logs"
    fi
  fi
}

# ── stop ──────────────────────────────────────────────────────────────────────
cmd_stop() {
  if has_pm2; then
    info "Arrêt via PM2…"
    pm2 stop "$APP_NAME" 2>/dev/null && success "Bot arrêté." || warn "Le bot ne semblait pas tourner."
  else
    local pid; pid=$(read_pid)
    if [[ -z "$pid" ]]; then
      warn "Aucun PID trouvé — le bot ne semble pas tourner."; return
    fi
    if kill -0 "$pid" 2>/dev/null; then
      info "Arrêt du processus $pid…"
      kill -SIGTERM "$pid"
      sleep 2
      kill -0 "$pid" 2>/dev/null && kill -SIGKILL "$pid"
      rm -f "$PID_FILE"
      success "Bot arrêté."
    else
      warn "Processus $pid introuvable. Nettoyage du PID file."
      rm -f "$PID_FILE"
    fi
  fi
}

# ── restart ───────────────────────────────────────────────────────────────────
cmd_restart() {
  info "Redémarrage…"
  cmd_stop
  sleep 1
  cmd_start
}

# ── status ────────────────────────────────────────────────────────────────────
cmd_status() {
  echo ""
  if has_pm2; then
    pm2 describe "$APP_NAME" 2>/dev/null || warn "Processus PM2 '${APP_NAME}' introuvable."
  else
    local pid; pid=$(read_pid)
    if [[ -z "$pid" ]]; then
      echo -e "  Statut : ${RED}● Arrêté${NC} (pas de PID)"
    elif kill -0 "$pid" 2>/dev/null; then
      # Uptime approximatif via /proc (Linux/WSL) ou ps (macOS/Git Bash)
      local uptime_str=""
      if [[ -f "/proc/${pid}/stat" ]]; then
        local start_ticks btime hz elapsed
        btime=$(grep btime /proc/stat | awk '{print $2}')
        start_ticks=$(awk '{print $22}' "/proc/${pid}/stat")
        hz=$(getconf CLK_TCK 2>/dev/null || echo 100)
        elapsed=$(( $(date +%s) - btime - start_ticks / hz ))
        uptime_str="  (~$(( elapsed / 3600 ))h $(( (elapsed % 3600) / 60 ))min)"
      fi
      echo -e "  Statut : ${GREEN}● En ligne${NC} (PID ${pid})${uptime_str}"
    else
      echo -e "  Statut : ${RED}● Mort${NC} (PID ${pid} inexistant — PID file périmé)"
      rm -f "$PID_FILE"
    fi
  fi
  echo ""
}

# ── logs ──────────────────────────────────────────────────────────────────────
cmd_logs() {
  local lines="${2:-50}"
  if has_pm2; then
    info "Logs PM2 (Ctrl+C pour quitter)…"
    pm2 logs "$APP_NAME" --lines "$lines"
  else
    if [[ -f "$LOG_FILE" ]]; then
      info "Dernières ${lines} lignes de ${LOG_FILE} (Ctrl+C pour quitter)…"
      tail -n "$lines" -f "$LOG_FILE"
    else
      warn "Aucun fichier de log trouvé (${LOG_FILE})."
    fi
  fi
}

# ── update ────────────────────────────────────────────────────────────────────
cmd_update() {
  banner
  info "Mise à jour de Grook Bot…"

  # Vérifie qu'on est dans un repo git
  if ! git rev-parse --git-dir &>/dev/null; then
    die "Ce dossier n'est pas un repo git. Mise à jour manuelle requise."
  fi

  # Affiche la version actuelle
  local before_hash; before_hash=$(git rev-parse --short HEAD)
  info "Version actuelle : ${before_hash}"

  info "Sauvegarde de la base de données…"
  cmd_backup quiet

  info "Récupération des modifications (git pull)…"
  git pull --ff-only || die "git pull a échoué. Résolvez les conflits manuellement."

  local after_hash; after_hash=$(git rev-parse --short HEAD)
  if [[ "$before_hash" == "$after_hash" ]]; then
    success "Déjà à jour (${after_hash})."
  else
    success "Mis à jour : ${before_hash} → ${after_hash}"
    local commits; commits=$(git log --oneline "${before_hash}..${after_hash}" 2>/dev/null)
    if [[ -n "$commits" ]]; then
      echo -e "\n${BOLD}Nouveaux commits :${NC}"
      echo "$commits" | while IFS= read -r line; do echo "  • $line"; done
      echo ""
    fi
  fi

  info "Mise à jour des dépendances…"
  npm ci --omit=dev 2>&1 | tail -3

  info "Redémarrage du bot…"
  cmd_restart

  success "Mise à jour terminée !"
}

# ── backup ────────────────────────────────────────────────────────────────────
cmd_backup() {
  local quiet="${1:-}"
  mkdir -p "$BACKUP_DIR"

  if [[ ! -f "$DB_FILE" ]]; then
    [[ -z "$quiet" ]] && warn "Base de données introuvable (${DB_FILE}) — rien à sauvegarder."
    return
  fi

  local ts; ts=$(date +"%Y%m%d-%H%M%S")
  local dest="${BACKUP_DIR}/grook-${ts}.db"
  cp "$DB_FILE" "$dest"
  [[ -z "$quiet" ]] && success "Backup créé : ${dest}"

  # Nettoyage des vieux backups (garde les 10 derniers)
  local count; count=$(ls -1 "${BACKUP_DIR}"/grook-*.db 2>/dev/null | wc -l)
  if (( count > 10 )); then
    local to_delete=$(( count - 10 ))
    ls -1t "${BACKUP_DIR}"/grook-*.db | tail -n "$to_delete" | xargs rm -f
    [[ -z "$quiet" ]] && info "Anciens backups supprimés (conservé : 10)."
  fi
}

# ── version ───────────────────────────────────────────────────────────────────
cmd_version() {
  local pkg_ver; pkg_ver=$(node -e "import('./package.json', {assert:{type:'json'}}).then(m=>process.stdout.write(m.default.version))" 2>/dev/null || grep -oP '(?<="version": ")[^"]+' package.json)
  local git_hash=""; git rev-parse --short HEAD &>/dev/null && git_hash=" ($(git rev-parse --short HEAD))"
  echo -e "${BOLD}Grook Bot v${pkg_ver}${NC}${git_hash}"
  node --version | xargs -I{} echo "Node.js {}"
  npm --version  | xargs -I{} echo "npm    v{}"
}

# ── dev ───────────────────────────────────────────────────────────────────────
cmd_dev() {
  check_requirements
  [[ -f ".env" ]] || die "Fichier .env introuvable."
  info "Démarrage en mode dev (--watch, rechargement automatique)…"
  node --watch src/index.js
}

# ── help ──────────────────────────────────────────────────────────────────────
cmd_help() {
  banner
  echo -e "${BOLD}Usage :${NC}  ./grook.sh <commande> [options]\n"
  echo -e "${BOLD}Commandes disponibles :${NC}"
  echo ""
  echo -e "  ${GREEN}install${NC}        Installe les dépendances, crée .env et les dossiers nécessaires"
  echo -e "  ${GREEN}start${NC}          Démarre le bot (via PM2 si disponible, sinon bare-node)"
  echo -e "  ${GREEN}stop${NC}           Arrête le bot"
  echo -e "  ${GREEN}restart${NC}        Redémarre le bot"
  echo -e "  ${GREEN}status${NC}         Affiche l'état du bot"
  echo -e "  ${GREEN}logs${NC} [N]       Affiche les N dernières lignes de log (défaut : 50)"
  echo -e "  ${GREEN}update${NC}         git pull + npm ci + redémarrage (avec backup auto)"
  echo -e "  ${GREEN}backup${NC}         Sauvegarde la base de données dans backups/"
  echo -e "  ${GREEN}version${NC}        Affiche la version du bot et de Node.js"
  echo -e "  ${GREEN}dev${NC}            Démarre en mode développement (--watch)"
  echo -e "  ${GREEN}help${NC}           Affiche ce message"
  echo ""
  echo -e "${BOLD}PM2 (recommandé) :${NC}"
  echo -e "  Si PM2 est installé (${CYAN}npm install -g pm2${NC}), le bot sera géré"
  echo -e "  avec redémarrage automatique, logs persistants et survie aux reboots."
  echo ""
  echo -e "${BOLD}Exemples :${NC}"
  echo -e "  ./grook.sh install     ${YELLOW}# première installation${NC}"
  echo -e "  ./grook.sh start       ${YELLOW}# démarrer${NC}"
  echo -e "  ./grook.sh logs 100    ${YELLOW}# voir les 100 dernières lignes${NC}"
  echo -e "  ./grook.sh update      ${YELLOW}# mettre à jour${NC}"
  echo ""
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  install)  cmd_install  ;;
  start)    cmd_start    ;;
  stop)     cmd_stop     ;;
  restart)  cmd_restart  ;;
  status)   cmd_status   ;;
  logs)     cmd_logs "" "${1:-50}" ;;
  update)   cmd_update   ;;
  backup)   cmd_backup   ;;
  version)  cmd_version  ;;
  dev)      cmd_dev      ;;
  help|--help|-h) cmd_help ;;
  *)
    error "Commande inconnue : '${COMMAND}'"
    echo -e "Lancez ${BOLD}./grook.sh help${NC} pour voir les commandes disponibles."
    exit 1
    ;;
esac
