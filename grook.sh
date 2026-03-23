#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  grook.sh — CLI de gestion de Grook Bot
#  Usage : ./grook.sh [commande] [options]
#  Sans argument → menu interactif
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Couleurs ANSI ($'...' pour que les vars contiennent l'octet ESC réel) ─────
R=$'\033[0;31m';  G=$'\033[0;32m';  Y=$'\033[1;33m';  B=$'\033[0;34m'
C=$'\033[0;36m';  M=$'\033[0;35m';  W=$'\033[1;37m';  DIM=$'\033[2m'
NC=$'\033[0m';    BOLD=$'\033[1m';  BG_SEL=$'\033[44m'; BLINK=$'\033[5m'

# ── Constantes ────────────────────────────────────────────────────────────────
APP_NAME="grook-bot"
PID_FILE=".grook.pid"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/grook.log"
DB_FILE="data/grook.db"
BACKUP_DIR="backups"
VERSION_FILE="src/version.js"
MIN_NODE_MAJOR=18

WEBHOOK_URL=""

# ── Helpers texte ─────────────────────────────────────────────────────────────
info()    { printf "  ${C}${BOLD}[INFO]${NC}  %s\n" "$*"; }
success() { printf "  ${G}${BOLD}[ OK ]${NC}  %s\n" "$*"; }
warn()    { printf "  ${Y}${BOLD}[WARN]${NC}  %s\n" "$*"; }
error()   { printf "  ${R}${BOLD}[ERR ]${NC}  %s\n" "$*" >&2; }
die()     { error "$*"; exit 1; }
step()    { printf "\n${BOLD}${B}  ▶  %s${NC}\n" "$*"; }

# ── Box drawing ───────────────────────────────────────────────────────────────
_hline() { printf '%0.s─' $(seq 1 "$1"); }

box_top() { printf "${DIM}  ┌$(_hline $(($1+2)))┐${NC}\n"; }
box_bot() { printf "${DIM}  └$(_hline $(($1+2)))┘${NC}\n"; }
box_sep() { printf "${DIM}  ├$(_hline $(($1+2)))┤${NC}\n"; }

# Ligne colorée dans une box — le padding est calculé SANS les codes ANSI
box_line() {
  local width="$1" text="$2"
  # Supprime les codes ANSI pour mesurer la longueur visible
  local visible; visible=$(printf "%s" "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local pad=$(( width - ${#visible} ))
  [[ $pad -lt 0 ]] && pad=0
  printf "${DIM}  │${NC} %s%*s ${DIM}│${NC}\n" "$text" "$pad" ""
}

box_head() {
  local width="$1" text="$2"
  printf "${DIM}  │${NC} ${BOLD}%-*s${NC} ${DIM}│${NC}\n" "$width" "$text"
}

# ── Spinner ───────────────────────────────────────────────────────────────────
SPINNER_PID=""
spinner_start() {
  local msg="${1:-Chargement…}"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  (
    local i=0
    while true; do
      printf "\r  ${C}${frames[$i]}${NC}  %s" "$msg"
      i=$(( (i+1) % ${#frames[@]} ))
      sleep 0.08
    done
  ) &
  SPINNER_PID=$!
}
spinner_stop() {
  [[ -n "$SPINNER_PID" ]] && kill "$SPINNER_PID" 2>/dev/null; SPINNER_PID=""
  if [[ "${1:-true}" == "true" ]]; then
    printf "\r  ${G}✔${NC}  %s\n" "${2:-OK}"
  else
    printf "\r  ${R}✖${NC}  %s\n" "${2:-Erreur}"
  fi
}

# ── Webhook Discord ───────────────────────────────────────────────────────────
load_webhook() {
  [[ -f ".env" ]] || return
  local val
  val=$(grep -oP '(?<=DISCORD_WEBHOOK_URL=)\S+' .env 2>/dev/null || true)
  [[ -n "$val" && "$val" != "your_webhook_url_here" ]] && WEBHOOK_URL="$val" || true
}

send_webhook() {
  [[ -z "$WEBHOOK_URL" ]] && return 0
  command -v curl &>/dev/null || return 0
  local color="$1" title="${2//\"/\\\"}" description="${3//\"/\\\"}"
  local ts; ts=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
  local host; host=$(hostname 2>/dev/null || echo "serveur")
  curl -sf -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"embeds\":[{\"title\":\"${title}\",\"description\":\"${description}\",\"color\":${color},\"timestamp\":\"${ts}\",\"footer\":{\"text\":\"Grook CLI · ${host}\"}}]}" \
    > /dev/null 2>&1 || true
}

WH_GREEN=5763719; WH_RED=15548997; WH_YELLOW=16705372; WH_BLUE=5793266; WH_PURPLE=10181046

# ── Version & Git ─────────────────────────────────────────────────────────────
get_version() {
  [[ -f "$VERSION_FILE" ]] || { echo "?"; return; }
  grep -oP "(?<=VERSION = ')[^']+" "$VERSION_FILE" 2>/dev/null || echo "?"
}
get_git_hash() { git rev-parse --short HEAD 2>/dev/null || echo "—"; }
get_git_msg()  { git log -1 --format="%s" 2>/dev/null | cut -c1-55 || echo ""; }

# ── Process helpers ───────────────────────────────────────────────────────────
has_pm2()      { command -v pm2 &>/dev/null; }
read_pid()     { [[ -f "$PID_FILE" ]] && cat "$PID_FILE" || echo ""; }
is_running_bare() { local p; p=$(read_pid); [[ -n "$p" ]] && kill -0 "$p" 2>/dev/null; }

get_process_info() {
  local pid="$1"
  if [[ -f "/proc/${pid}/status" ]]; then
    local rss; rss=$(grep VmRSS /proc/"${pid}"/status 2>/dev/null | awk '{print $2}')
    echo "$(( rss / 1024 ))MB $(ps -p "$pid" -o %cpu --no-headers 2>/dev/null | tr -d ' ' || echo "?")%"
  else
    local info; info=$(ps -p "$pid" -o rss,%cpu --no-headers 2>/dev/null || echo "0 0")
    echo "$(( $(echo "$info" | awk '{print $1}') / 1024 ))MB $(echo "$info" | awk '{print $2}')%"
  fi
}

get_uptime_str() {
  local pid="$1" elapsed=0
  if [[ -f "/proc/${pid}/stat" ]]; then
    local btime start_ticks hz
    btime=$(grep -oP '(?<=btime )\d+' /proc/stat 2>/dev/null || echo 0)
    start_ticks=$(awk '{print $22}' "/proc/${pid}/stat" 2>/dev/null || echo 0)
    hz=$(getconf CLK_TCK 2>/dev/null || echo 100)
    elapsed=$(( $(date +%s) - btime - start_ticks / hz ))
  else
    local etime; etime=$(ps -p "$pid" -o etime --no-headers 2>/dev/null | tr -d ' ' || echo "")
    [[ -z "$etime" ]] && echo "?" && return
    local days=0 hours=0 mins=0 secs=0
    if   [[ "$etime" =~ ^([0-9]+)-([0-9]+):([0-9]+):([0-9]+)$ ]]; then
      days=${BASH_REMATCH[1]}; hours=${BASH_REMATCH[2]}; mins=${BASH_REMATCH[3]}; secs=${BASH_REMATCH[4]}
    elif [[ "$etime" =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
      hours=${BASH_REMATCH[1]}; mins=${BASH_REMATCH[2]}; secs=${BASH_REMATCH[3]}
    elif [[ "$etime" =~ ^([0-9]+):([0-9]+)$ ]]; then
      mins=${BASH_REMATCH[1]}; secs=${BASH_REMATCH[2]}
    fi
    elapsed=$(( days*86400 + hours*3600 + mins*60 + secs ))
  fi
  local d=$(( elapsed/86400 )) h=$(( (elapsed%86400)/3600 )) m=$(( (elapsed%3600)/60 )) s=$(( elapsed%60 ))
  [[ $d -gt 0 ]] && echo "${d}j ${h}h ${m}min" && return
  [[ $h -gt 0 ]] && echo "${h}h ${m}min ${s}s" && return
  [[ $m -gt 0 ]] && echo "${m}min ${s}s"        && return
  echo "${s}s"
}

# ── Status bot (1 ligne) ──────────────────────────────────────────────────────
bot_status_line() {
  if has_pm2; then
    local st; st=$(pm2 jlist 2>/dev/null | node -e "
      const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const p=d.find(x=>x.name==='${APP_NAME}');
      console.log(p?.pm2_env?.status||'offline');
    " 2>/dev/null || echo "offline")
    case "$st" in
      online)  echo "${G}● EN LIGNE${NC} (PM2)" ;;
      stopped) echo "${Y}● ARRÊTÉ${NC}  (PM2)" ;;
      *)       echo "${R}● ${st^^}${NC}  (PM2)" ;;
    esac
  else
    local pid; pid=$(read_pid)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "${G}● EN LIGNE${NC} (PID ${pid})"
    else
      echo "${R}● ARRÊTÉ${NC}"
    fi
  fi
}

# ── Banner ────────────────────────────────────────────────────────────────────
banner() {
  local ver; ver=$(get_version)
  printf "\n${BOLD}${B}"
  printf '  ██████╗ ██████╗  ██████╗  ██████╗ ██╗  ██╗\n'
  printf ' ██╔════╝ ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝\n'
  printf ' ██║  ███╗██████╔╝██║   ██║██║   ██║█████╔╝ \n'
  printf ' ██║   ██║██╔══██╗██║   ██║██║   ██║██╔═██╗ \n'
  printf ' ╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝██║  ██╗\n'
  printf '  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝\n'
  printf "${NC}  ${BOLD}v${ver}${NC} ${DIM}— by Root3301${NC}\n\n"
}

# ══════════════════════════════════════════════════════════════════════════════
# MENU INTERACTIF (saisie numérique)
# ══════════════════════════════════════════════════════════════════════════════

# "numéro|clé|label|description"  — groupés visuellement par section
MENU_ITEMS=(
  # ── Cycle de vie ──────────────────────────────────────────────────────────
  " 1|start|Démarrer|Démarre le bot"
  " 2|stop|Arrêter|Arrête le bot"
  " 3|restart|Redémarrer|Redémarre le bot"
  " 4|dev|Mode dev|node --watch, rechargement auto"
  # ── Monitoring ────────────────────────────────────────────────────────────
  " 5|status|Statut|Affiche le statut du bot"
  " 6|monitor|Dashboard|Temps réel : RAM, CPU, uptime, logs"
  " 7|health|Diagnostic|Vérifie l'installation complète"
  " 8|logs|Logs|Affiche les derniers logs"
  # ── Maintenance ───────────────────────────────────────────────────────────
  " 9|update|Mettre à jour|git pull + npm ci + backup + restart"
  "10|backup|Sauvegarder DB|Copie la base de données (rotation 10)"
  "11|config|Configuration|Affiche .env (valeurs masquées)"
  "12|webhook-test|Test Webhook|Envoie une notification Discord test"
  "13|version|Versions|Node, npm, PM2, bot"
  "14|install|Installer|Installation initiale des dépendances"
)

menu_num()  { echo "${MENU_ITEMS[$1]}" | cut -d'|' -f1 | tr -d ' '; }
menu_key()  { echo "${MENU_ITEMS[$1]}" | cut -d'|' -f2; }
menu_lbl()  { echo "${MENU_ITEMS[$1]}" | cut -d'|' -f3; }
menu_desc() { echo "${MENU_ITEMS[$1]}" | cut -d'|' -f4; }

draw_menu() {
  local W=60
  clear
  banner

  local st_line; st_line=$(bot_status_line)
  printf "  Bot : %b\n\n" "$st_line"

  box_top $W
  box_head $W "  🚀 Cycle de vie"
  box_sep $W
  for i in 0 1 2 3; do
    box_line $W "  ${Y}$(menu_num $i)${NC}  ${G}$(printf '%-16s' "$(menu_lbl $i)")${NC}${DIM}$(menu_desc $i)${NC}"
  done
  box_sep $W
  box_head $W "  📊 Monitoring"
  box_sep $W
  for i in 4 5 6 7; do
    box_line $W "  ${Y}$(menu_num $i)${NC}  ${G}$(printf '%-16s' "$(menu_lbl $i)")${NC}${DIM}$(menu_desc $i)${NC}"
  done
  box_sep $W
  box_head $W "  🔧 Maintenance"
  box_sep $W
  for i in 8 9 10 11 12 13; do
    box_line $W "  ${Y}$(menu_num $i)${NC}  ${G}$(printf '%-16s' "$(menu_lbl $i)")${NC}${DIM}$(menu_desc $i)${NC}"
  done
  box_sep $W
  box_line $W "  ${DIM}q  Quitter${NC}"
  box_bot $W
  printf "\n  ${BOLD}Votre choix :${NC} "
}

exec_menu_key() {
  local key="$1"
  clear
  banner
  case "$key" in
    start)        cmd_start ;;
    stop)         cmd_stop ;;
    restart)      cmd_restart ;;
    dev)
      printf "  ${Y}Mode dev — Ctrl+C pour quitter.${NC}\n\n"
      cmd_dev; return ;;
    status)       cmd_status ;;
    monitor)
      printf "  ${DIM}Intervalle en secondes (défaut 2) : ${NC}"
      local s; read -r s
      cmd_monitor "${s:-2}"; return ;;
    health)       cmd_health ;;
    logs)
      printf "  ${DIM}Nombre de lignes (défaut 50) : ${NC}"
      local n; read -r n
      cmd_logs "${n:-50}" ;;
    update)       cmd_update ;;
    backup)       cmd_backup ;;
    config)       cmd_config_show ;;
    webhook-test) cmd_webhook_test ;;
    version)      cmd_version ;;
    install)      cmd_install ;;
    *)            warn "Commande inconnue." ;;
  esac
  printf "\n  ${DIM}Entrée pour revenir au menu…${NC}"; read -r
}

cmd_menu() {
  trap 'printf "\n\n  ${G}À bientôt !${NC}\n\n"; exit 0' INT TERM

  while true; do
    draw_menu
    local input; read -r input
    [[ "$input" == "q" || "$input" == "Q" ]] && {
      printf "\n  ${G}À bientôt !${NC}\n\n"; exit 0
    }
    # Recherche de l'entrée correspondant au numéro saisi
    local found=0
    for (( i=0; i<${#MENU_ITEMS[@]}; i++ )); do
      if [[ "$(menu_num $i)" == "$input" ]]; then
        exec_menu_key "$(menu_key $i)"
        found=1; break
      fi
    done
    (( found == 0 )) && {
      printf "  ${R}Choix invalide : %s${NC}\n" "$input"
      sleep 1
    }
  done
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMANDES
# ══════════════════════════════════════════════════════════════════════════════

cmd_install() {
  banner
  load_webhook
  step "Vérification des prérequis"

  command -v node &>/dev/null || die "Node.js introuvable. Installez Node ${MIN_NODE_MAJOR}+ : https://nodejs.org"
  local major; major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  (( major >= MIN_NODE_MAJOR )) || die "Node.js ${major} détecté — version ${MIN_NODE_MAJOR}+ requise."
  command -v npm &>/dev/null || die "npm introuvable."
  success "Node $(node -v) · npm $(npm -v)"

  step "Configuration"
  if [[ ! -f ".env" ]]; then
    [[ -f ".env.example" ]] && cp ".env.example" ".env" && warn ".env créé — renseignez DISCORD_TOKEN !"
  else
    info ".env déjà présent."
  fi

  mkdir -p data logs backups

  has_pm2 && success "PM2 $(pm2 --version) détecté." \
          || warn "PM2 non installé. Recommandé : ${BOLD}npm install -g pm2${NC}"

  step "Installation des dépendances"
  spinner_start "npm ci en cours…"
  if npm ci --omit=dev > /tmp/grook_npm.log 2>&1; then
    spinner_stop true "Dépendances installées."
  else
    spinner_stop false "Échec npm ci"
    cat /tmp/grook_npm.log
    die "Installation échouée."
  fi

  send_webhook $WH_GREEN "✅ Installation terminée" "Grook Bot installé sur \`$(hostname)\`\nVersion : \`$(get_version)\`"
  success "Installation terminée ! Éditez .env puis démarrez le bot."
}

cmd_start() {
  load_webhook
  [[ -f "package.json" ]] || die "Lancez ce script depuis la racine du projet."
  [[ -f ".env" ]]         || die ".env introuvable. Lancez install d'abord."
  local ver; ver=$(get_version)
  local hash; hash=$(get_git_hash)

  if has_pm2; then
    info "Démarrage via PM2…"
    mkdir -p "$LOG_DIR"
    if pm2 describe "$APP_NAME" &>/dev/null; then
      pm2 restart "$APP_NAME" --update-env
    else
      pm2 start src/index.js \
        --name "$APP_NAME" \
        --interpreter node \
        --log "$LOG_FILE" \
        --time \
        --restart-delay=3000 \
        --max-restarts=15 \
        --exp-backoff-restart-delay=100
    fi
    pm2 save --force &>/dev/null
    success "Bot démarré via PM2."
  else
    is_running_bare && { warn "Déjà en cours (PID $(read_pid)). Utilisez restart."; return; }
    mkdir -p "$LOG_DIR"
    info "Démarrage bare-node (logs → ${LOG_FILE})…"
    nohup node src/index.js >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    if is_running_bare; then
      success "Bot démarré (PID $(read_pid))."
    else
      send_webhook $WH_RED "❌ Démarrage échoué" "Le bot a crashé immédiatement sur \`$(hostname)\`"
      die "Le bot a crashé. Consultez les logs."
    fi
  fi
  send_webhook $WH_GREEN "🚀 Bot démarré" "**Grook Bot v${ver}** en ligne sur \`$(hostname)\`\nCommit : \`${hash}\`"
}

cmd_stop() {
  load_webhook
  local ver; ver=$(get_version)
  if has_pm2; then
    pm2 stop "$APP_NAME" 2>/dev/null && success "Bot arrêté (PM2)." || warn "PM2 : processus introuvable."
  else
    local pid; pid=$(read_pid)
    [[ -z "$pid" ]] && { warn "Aucun PID — bot non démarré."; return; }
    if kill -0 "$pid" 2>/dev/null; then
      kill -SIGTERM "$pid"; sleep 2
      kill -0 "$pid" 2>/dev/null && kill -SIGKILL "$pid"
      rm -f "$PID_FILE"; success "Bot arrêté (PID ${pid})."
    else
      warn "Processus ${pid} inexistant — nettoyage du PID file."
      rm -f "$PID_FILE"
    fi
  fi
  send_webhook $WH_YELLOW "🛑 Bot arrêté" "**Grook Bot v${ver}** arrêté sur \`$(hostname)\`"
}

cmd_restart() {
  info "Redémarrage…"
  if has_pm2; then
    load_webhook
    pm2 restart "$APP_NAME" --update-env && success "Bot redémarré (PM2)."
    send_webhook $WH_BLUE "🔄 Bot redémarré" "Redémarrage sur \`$(hostname)\`"
  else
    cmd_stop; sleep 1; cmd_start
  fi
}

cmd_status() {
  local W=54
  echo ""
  box_top $W
  box_head $W "  ⚙️  GROOK BOT — STATUT"
  box_sep $W

  local ver; ver=$(get_version)
  local hash; hash=$(get_git_hash)
  local git_msg; git_msg=$(get_git_msg)

  if has_pm2; then
    local pm2_status; pm2_status=$(pm2 jlist 2>/dev/null | node -e "
      const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const p=d.find(x=>x.name==='${APP_NAME}');
      if(!p){console.log('offline|—|?|?');process.exit();}
      const e=Date.now()-p.pm2_env.pm_uptime;
      const s=Math.floor(e/1000),m=Math.floor(s/60),h=Math.floor(m/60),d2=Math.floor(h/24);
      const up=p.pm2_env.status==='online'?(d2>0?d2+'j '+h%24+'h':h>0?h+'h '+m%60+'min':m>0?m+'min '+s%60+'s':s+'s'):'—';
      console.log(p.pm2_env.status+'|'+up+'|'+(p.monit?.memory/1024/1024||0).toFixed(1)+'|'+(p.monit?.cpu||0));
    " 2>/dev/null || echo "unknown|—|?|?")
    IFS='|' read -r pm_status uptime mem cpu <<< "$pm2_status"
    case "$pm_status" in
      online)  box_line $W "  Statut  : ${G}● EN LIGNE${NC}  (PM2)" ;;
      stopped) box_line $W "  Statut  : ${Y}● ARRÊTÉ${NC}   (PM2)" ;;
      *)       box_line $W "  Statut  : ${R}● ${pm_status^^}${NC}  (PM2)" ;;
    esac
    box_line $W "  Uptime  : ${uptime}"
    box_line $W "  RAM     : ${mem} MB   CPU : ${cpu}%"
  else
    local pid; pid=$(read_pid)
    if [[ -z "$pid" ]]; then
      box_line $W "  Statut  : ${R}● ARRÊTÉ${NC}  (pas de PID)"
    elif kill -0 "$pid" 2>/dev/null; then
      local pinfo; pinfo=$(get_process_info "$pid")
      local upt;   upt=$(get_uptime_str "$pid")
      box_line $W "  Statut  : ${G}● EN LIGNE${NC}  (PID ${pid})"
      box_line $W "  Uptime  : ${upt}"
      box_line $W "  RAM / CPU : ${pinfo}"
    else
      box_line $W "  Statut  : ${R}● MORT${NC}  (PID ${pid} inexistant)"
      rm -f "$PID_FILE"
    fi
  fi

  box_sep $W
  box_line $W "  Version : ${G}v${ver}${NC}   Node : $(node -v 2>/dev/null || echo '?')"
  box_line $W "  Git     : ${C}${hash}${NC}  ${DIM}${git_msg}${NC}"
  box_bot $W
  echo ""
}

cmd_monitor() {
  command -v tput &>/dev/null || { warn "tput non disponible — utilisez status."; return; }
  local interval="${1:-2}"
  local iter=0

  trap 'tput rmcup 2>/dev/null; tput cnorm 2>/dev/null; printf "\n${G}  Monitor fermé.${NC}\n\n"; exit 0' INT TERM

  tput smcup
  tput civis

  while true; do
    tput cup 0 0
    local ver; ver=$(get_version)
    local hash; hash=$(get_git_hash)
    local git_msg; git_msg=$(get_git_msg)
    local now; now=$(date '+%H:%M:%S')
    local W=62

    printf "${BOLD}${B}  ██████╗ ██████╗  ██████╗  ██████╗ ██╗  ██╗${NC}"
    printf "  ${BOLD}MONITOR${NC}\n"
    printf "  ${DIM}Rafraîchissement : ${interval}s · Ctrl+C pour quitter${NC}\n\n"

    box_top $W
    box_head $W "  ● STATUT"
    box_sep $W

    if has_pm2; then
      local pm2_json; pm2_json=$(pm2 jlist 2>/dev/null || echo "[]")
      local pm_status; pm_status=$(echo "$pm2_json" | node -e "
        const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const p=d.find(x=>x.name==='${APP_NAME}');
        console.log(p?.pm2_env?.status||'offline');
      " 2>/dev/null || echo "offline")
      local uptime; uptime=$(echo "$pm2_json" | node -e "
        const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const p=d.find(x=>x.name==='${APP_NAME}');
        if(!p||p.pm2_env.status!=='online'){console.log('—');process.exit();}
        const e=Date.now()-p.pm2_env.pm_uptime;
        const s=Math.floor(e/1000),m=Math.floor(s/60),h=Math.floor(m/60),d2=Math.floor(h/24);
        console.log(d2>0?d2+'j '+h%24+'h':h>0?h+'h '+m%60+'min':m>0?m+'min '+s%60+'s':s+'s');
      " 2>/dev/null || echo "?")
      local mem; mem=$(echo "$pm2_json" | node -e "
        const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const p=d.find(x=>x.name==='${APP_NAME}');
        console.log(p?.monit?.memory?(p.monit.memory/1024/1024).toFixed(1)+'MB':'?');
      " 2>/dev/null || echo "?")
      local cpu; cpu=$(echo "$pm2_json" | node -e "
        const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const p=d.find(x=>x.name==='${APP_NAME}');
        console.log(p?.monit?.cpu!==undefined?p.monit.cpu+'%':'?');
      " 2>/dev/null || echo "?")

      if [[ "$pm_status" == "online" ]]; then
        box_line $W "  Statut  : ${G}● EN LIGNE${NC}  (PM2)"
      else
        box_line $W "  Statut  : ${R}● ${pm_status^^}${NC}  (PM2)"
      fi
      box_line $W "  Uptime  : ${uptime}"
      box_line $W "  RAM     : ${mem}    CPU : ${cpu}"
    else
      local pid; pid=$(read_pid)
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        local pinfo; pinfo=$(get_process_info "$pid")
        local upt;   upt=$(get_uptime_str "$pid")
        box_line $W "  Statut  : ${G}● EN LIGNE${NC}  PID ${pid}"
        box_line $W "  Uptime  : ${upt}"
        box_line $W "  RAM / CPU : ${pinfo}"
      else
        box_line $W "  Statut  : ${R}● ARRÊTÉ${NC}"
        box_line $W "  Lancez start pour démarrer le bot"
        rm -f "$PID_FILE"
      fi
    fi

    box_sep $W
    box_head $W "  ▸ Infos"
    box_sep $W
    box_line $W "  Version : ${G}v${ver}${NC}   Node : $(node -v 2>/dev/null || echo '?')"
    box_line $W "  Git     : ${C}${hash}${NC}  ${DIM}${git_msg}${NC}"
    [[ -f "$DB_FILE" ]] && {
      local db_size; db_size=$(du -sh "$DB_FILE" 2>/dev/null | awk '{print $1}')
      box_line $W "  DB      : grook.db  (${db_size})"
    }

    box_sep $W
    box_head $W "  ▸ Logs récents"
    box_sep $W
    if [[ -f "$LOG_FILE" ]]; then
      while IFS= read -r line; do
        local trimmed="${line:0:$W}"
        box_line $W "  ${DIM}${trimmed}${NC}"
      done < <(tail -n 6 "$LOG_FILE" 2>/dev/null)
    else
      box_line $W "  ${DIM}(aucun log disponible)${NC}"
    fi
    box_bot $W

    printf "\n  ${DIM}Actualisé à ${now} · refresh #$((++iter))${NC}      \n"
    sleep "$interval"
  done
}

cmd_health() {
  local issues=0
  echo ""
  printf "  ${BOLD}🏥  Health Check — Grook Bot${NC}\n\n"

  command -v node &>/dev/null && {
    local major; major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
    (( major >= MIN_NODE_MAJOR )) \
      && success "Node.js $(node -v)" \
      || { error "Node.js $(node -v) — version ${MIN_NODE_MAJOR}+ requise"; (( issues++ )) || true; }
  } || { error "Node.js introuvable"; (( issues++ )) || true; }

  if [[ -f ".env" ]]; then
    grep -q "DISCORD_TOKEN=.\+" .env 2>/dev/null \
      && success "DISCORD_TOKEN configuré" \
      || { error "DISCORD_TOKEN manquant dans .env"; (( issues++ )) || true; }
    grep -q "DISCORD_WEBHOOK_URL=.\+" .env 2>/dev/null \
      && success "Webhook Discord configuré" \
      || warn "Webhook non configuré (optionnel)"
  else
    error ".env manquant"; (( issues++ )) || true
  fi

  [[ -d "node_modules" ]] \
    && success "node_modules présent" \
    || { error "node_modules absent — lancez install"; (( issues++ )) || true; }

  [[ -f "$DB_FILE" ]] \
    && success "Base de données : $(du -sh "$DB_FILE" 2>/dev/null | awk '{print $1}')" \
    || warn "Base de données absente (créée au 1er démarrage)"

  has_pm2 \
    && success "PM2 $(pm2 --version) disponible" \
    || warn "PM2 non installé (recommandé)"

  if has_pm2; then
    local st; st=$(pm2 jlist 2>/dev/null | node -e "
      const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const p=d.find(x=>x.name==='${APP_NAME}');
      console.log(p?.pm2_env?.status||'offline');
    " 2>/dev/null || echo "offline")
    [[ "$st" == "online" ]] && success "Bot en ligne (PM2)" || warn "Bot arrêté (PM2 : ${st})"
  elif is_running_bare; then
    success "Bot en ligne (PID $(read_pid))"
  else
    warn "Bot non démarré"
  fi

  git rev-parse --git-dir &>/dev/null 2>&1 && {
    local br; br=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")
    local remote_ref; remote_ref=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "origin/${br}")
    git fetch origin "$br" &>/dev/null || true
    local behind; behind=$(git rev-list "HEAD..${remote_ref}" --count 2>/dev/null || echo "?")
    [[ "$behind" == "0" ]] \
      && success "Git à jour — ${C}${br}${NC} ($(get_git_hash))" \
      || warn "${behind} commit(s) en retard sur ${remote_ref}"
  }

  echo ""
  if (( issues == 0 )); then
    printf "  ${G}${BOLD}✔  Tout est en ordre.${NC}\n\n"
  else
    printf "  ${R}${BOLD}✖  ${issues} problème(s) détecté(s).${NC}\n\n"
  fi
}

cmd_logs() {
  local lines="${1:-50}"
  if has_pm2; then
    info "Logs PM2 — Ctrl+C pour quitter…"
    pm2 logs "$APP_NAME" --lines "$lines"
  elif [[ -f "$LOG_FILE" ]]; then
    info "Dernières ${lines} lignes — Ctrl+C pour quitter…"
    tail -n "$lines" -f "$LOG_FILE"
  else
    warn "Aucun fichier de log trouvé (${LOG_FILE})."
  fi
}

cmd_update() {
  banner
  load_webhook
  step "Mise à jour de Grook Bot"

  git rev-parse --git-dir &>/dev/null || die "Pas un dépôt git."

  # Détection de la branche courante + branche de tracking distante
  local branch; branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")
  local remote; remote=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "origin/${branch}")
  info "Branche : ${C}${branch}${NC}  →  remote : ${C}${remote}${NC}"

  local before; before=$(get_git_hash)
  local ver_before; ver_before=$(get_version)

  step "Sauvegarde de la DB"
  cmd_backup quiet

  step "Récupération des modifications"
  spinner_start "git fetch…"
  git fetch origin "$branch" &>/dev/null \
    && spinner_stop true "Fetch OK" \
    || { spinner_stop false "git fetch échoué"; send_webhook $WH_RED "❌ Update échoué" "Échec git fetch sur \`$(hostname)\`"; die "Vérifiez la connexion."; }

  local behind; behind=$(git rev-list "HEAD..${remote}" --count 2>/dev/null || echo "0")
  [[ "$behind" == "0" ]] && { success "Déjà à jour ($(get_git_hash))."; return; }
  info "${behind} commit(s) disponible(s)."

  spinner_start "git pull…"
  git pull --ff-only origin "$branch" &>/dev/null \
    && spinner_stop true "Merge OK" \
    || { spinner_stop false "Conflit git"; send_webhook $WH_RED "❌ Update échoué" "Conflit git sur \`$(hostname)\`"; die "Résolvez les conflits manuellement."; }

  local after; after=$(get_git_hash)
  local ver_after; ver_after=$(get_version)

  printf "\n  ${DIM}Commits :${NC}\n"
  git log --oneline "${before}..${after}" | while IFS= read -r l; do printf "    ${C}•${NC} %s\n" "$l"; done
  echo ""

  step "Mise à jour des dépendances"
  spinner_start "npm ci…"
  npm ci --omit=dev > /tmp/grook_npm.log 2>&1 \
    && spinner_stop true "Dépendances OK" \
    || { spinner_stop false "npm ci échoué"; cat /tmp/grook_npm.log; die "Vérifiez package.json."; }

  step "Redémarrage"
  cmd_restart

  send_webhook $WH_GREEN "🔄 Bot mis à jour" \
    "**v${ver_before}** → **v${ver_after}** sur \`$(hostname)\`\n\`${before}\` → \`${after}\`"
  success "Mise à jour terminée ! ${before} → ${after}"
}

cmd_backup() {
  load_webhook
  local quiet="${1:-}"
  mkdir -p "$BACKUP_DIR"
  [[ -f "$DB_FILE" ]] || { [[ -z "$quiet" ]] && warn "Base de données introuvable."; return; }

  local ts; ts=$(date +"%Y%m%d-%H%M%S")
  local dest="${BACKUP_DIR}/grook-${ts}.db"
  cp "$DB_FILE" "$dest"
  local size; size=$(du -sh "$dest" 2>/dev/null | awk '{print $1}')
  [[ -z "$quiet" ]] && success "Backup : ${dest} (${size})"

  local count; count=$(ls -1 "${BACKUP_DIR}"/grook-*.db 2>/dev/null | wc -l)
  if (( count > 10 )); then
    local to_del=$(( count - 10 ))
    ls -1t "${BACKUP_DIR}"/grook-*.db | tail -n "$to_del" | xargs rm -f
    [[ -z "$quiet" ]] && info "${to_del} ancien(s) backup(s) supprimé(s)."
  fi

  [[ -z "$quiet" ]] && send_webhook $WH_BLUE "💾 Backup créé" \
    "Sauvegarde \`${dest}\` (${size}) sur \`$(hostname)\`"
}

cmd_config_show() {
  [[ -f ".env" ]] || { warn ".env introuvable."; return; }
  echo ""
  printf "  ${BOLD}📋  Configuration .env${NC}\n\n"
  while IFS= read -r line; do
    if [[ "$line" =~ ^#.*$ || -z "$line" ]]; then
      printf "  ${DIM}%s${NC}\n" "$line"
    else
      local key val
      key=$(echo "$line" | cut -d= -f1)
      val=$(echo "$line" | cut -d= -f2-)
      if echo "$key" | grep -qiE 'TOKEN|KEY|SECRET|PASSWORD|WEBHOOK'; then
        local masked
        [[ ${#val} -ge 10 ]] && masked="${val:0:4}$(printf '*%.0s' $(seq 1 $((${#val}-8))))${val: -4}" || masked="***"
        printf "  ${C}%s${NC}=${Y}%s${NC}\n" "$key" "$masked"
      else
        printf "  ${C}%s${NC}=${G}%s${NC}\n" "$key" "$val"
      fi
    fi
  done < .env
  echo ""
}

cmd_webhook_test() {
  load_webhook
  if [[ -z "$WEBHOOK_URL" ]]; then
    warn "DISCORD_WEBHOOK_URL non configurée dans .env"
    info "Ajoutez : DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/..."
    return
  fi
  info "Envoi d'un message de test…"
  send_webhook $WH_PURPLE "🔔 Test Webhook" \
    "Webhook opérationnel sur \`$(hostname)\`\nGrook Bot v$(get_version) · \`$(get_git_hash)\`"
  success "Message envoyé ! Vérifiez votre salon Discord."
}

cmd_version() {
  local ver; ver=$(get_version)
  local hash; hash=$(get_git_hash)
  local W=40
  echo ""
  box_top $W
  box_head $W "  📦 Grook Bot v${ver}"
  box_sep $W
  box_line $W "  Bot     : ${G}v${ver}${NC}  (${C}${hash}${NC})"
  box_line $W "  Node.js : $(node --version 2>/dev/null || echo '?')"
  box_line $W "  npm     : v$(npm --version 2>/dev/null || echo '?')"
  has_pm2 && box_line $W "  PM2     : v$(pm2 --version 2>/dev/null || echo '?')" || true
  box_bot $W
  echo ""
}

cmd_dev() {
  [[ -f ".env" ]] || die ".env introuvable."
  info "Mode développement (--watch)…"
  node --watch src/index.js
}

cmd_help() {
  banner
  local W=62
  box_top $W
  box_head $W "  Usage : ./grook.sh [commande]  —  sans arg : menu interactif"
  box_sep $W
  box_head $W "  🚀 Cycle de vie"
  box_sep $W
  box_line $W "  ${G}install${NC}          Installe les dépendances, .env, dossiers"
  box_line $W "  ${G}start${NC}            Démarre le bot (PM2 ou bare-node)"
  box_line $W "  ${G}stop${NC}             Arrête le bot"
  box_line $W "  ${G}restart${NC}          Redémarre le bot"
  box_line $W "  ${G}dev${NC}              Mode dev (node --watch)"
  box_sep $W
  box_head $W "  📊 Monitoring"
  box_sep $W
  box_line $W "  ${G}status${NC}           Statut rapide du bot"
  box_line $W "  ${G}monitor${NC} [sec]    Dashboard temps réel (défaut : 2s)"
  box_line $W "  ${G}health${NC}           Diagnostic complet de l'installation"
  box_line $W "  ${G}logs${NC} [N]         Dernières N lignes (défaut : 50)"
  box_sep $W
  box_head $W "  🔧 Maintenance"
  box_sep $W
  box_line $W "  ${G}update${NC}           git pull + npm ci + backup + restart"
  box_line $W "  ${G}backup${NC}           Sauvegarde la DB (rotation 10 derniers)"
  box_line $W "  ${G}config${NC}           Affiche .env (valeurs masquées)"
  box_line $W "  ${G}webhook-test${NC}     Teste la notification Discord webhook"
  box_line $W "  ${G}version${NC}          Versions du bot, Node, npm, PM2"
  box_sep $W
  box_line $W "  ${DIM}PM2 : npm install -g pm2${NC}"
  box_line $W "  ${DIM}Webhook : DISCORD_WEBHOOK_URL= dans .env${NC}"
  box_bot $W
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# DISPATCH
# ══════════════════════════════════════════════════════════════════════════════
COMMAND="${1:-menu}"
shift || true

case "$COMMAND" in
  menu|"")      cmd_menu          ;;
  install)      cmd_install       ;;
  start)        cmd_start         ;;
  stop)         cmd_stop          ;;
  restart)      cmd_restart       ;;
  status)       cmd_status        ;;
  monitor)      cmd_monitor "${1:-2}" ;;
  health)       cmd_health        ;;
  logs)         cmd_logs "${1:-50}" ;;
  update)       cmd_update        ;;
  backup)       cmd_backup        ;;
  config)       cmd_config_show   ;;
  webhook-test) cmd_webhook_test  ;;
  version)      cmd_version       ;;
  dev)          cmd_dev           ;;
  help|--help|-h) cmd_help        ;;
  *)
    error "Commande inconnue : '${COMMAND}'"
    printf "  Lancez ${BOLD}./grook.sh help${NC} pour la liste.\n"
    exit 1
    ;;
esac
