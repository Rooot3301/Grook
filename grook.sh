#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  grook.sh — CLI de gestion de Grook Bot
#  Usage : ./grook.sh <commande> [options]
#  Compatible : Linux, macOS, Git Bash (Windows)
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Couleurs ANSI ─────────────────────────────────────────────────────────────
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'
C='\033[0;36m'; M='\033[0;35m'; W='\033[1;37m'; DIM='\033[2m'; NC='\033[0m'
BOLD='\033[1m'; BLINK='\033[5m'

# ── Constantes ────────────────────────────────────────────────────────────────
APP_NAME="grook-bot"
PID_FILE=".grook.pid"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/grook.log"
DB_FILE="data/grook.db"
BACKUP_DIR="backups"
VERSION_FILE="src/version.js"
MIN_NODE_MAJOR=18

# Discord webhook (chargé depuis .env)
WEBHOOK_URL=""

# ── Helpers texte ─────────────────────────────────────────────────────────────
info()    { echo -e "${C}${BOLD}[INFO]${NC}  $*"; }
success() { echo -e "${G}${BOLD}[ OK ]${NC}  $*"; }
warn()    { echo -e "${Y}${BOLD}[WARN]${NC}  $*"; }
error()   { echo -e "${R}${BOLD}[ERR ]${NC}  $*" >&2; }
die()     { error "$*"; exit 1; }
step()    { echo -e "\n${BOLD}${B}▶ $*${NC}"; }

# ── Box drawing ───────────────────────────────────────────────────────────────
box_line()  { printf "${DIM}│${NC} %-*s ${DIM}│${NC}\n" "$1" "$2"; }
box_top()   { printf "${DIM}┌%s┐${NC}\n" "$(printf '─%.0s' $(seq 1 $(($1+2))))"; }
box_bot()   { printf "${DIM}└%s┘${NC}\n" "$(printf '─%.0s' $(seq 1 $(($1+2))))"; }
box_sep()   { printf "${DIM}├%s┤${NC}\n" "$(printf '─%.0s' $(seq 1 $(($1+2))))"; }

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
  local ok="${1:-true}"
  [[ -n "$SPINNER_PID" ]] && kill "$SPINNER_PID" 2>/dev/null; SPINNER_PID=""
  if [[ "$ok" == "true" ]]; then
    printf "\r  ${G}✔${NC}  $2\n"
  else
    printf "\r  ${R}✖${NC}  $2\n"
  fi
}

# ── Webhook Discord ───────────────────────────────────────────────────────────
load_webhook() {
  [[ -f ".env" ]] || return
  local val
  val=$(grep -oP '(?<=DISCORD_WEBHOOK_URL=)\S+' .env 2>/dev/null || true)
  [[ -n "$val" && "$val" != "your_webhook_url_here" ]] && WEBHOOK_URL="$val" || true
}

# Envoie un embed dans Discord via webhook
# send_webhook <couleur_int> <titre> <description> [champs_json]
send_webhook() {
  [[ -z "$WEBHOOK_URL" ]] && return 0
  command -v curl &>/dev/null || return 0
  local color="$1" title="$2" description="$3"
  local ts; ts=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)
  local host; host=$(hostname 2>/dev/null || echo "serveur")
  # Escape quotes in strings
  title="${title//\"/\\\"}"
  description="${description//\"/\\\"}"
  local payload
  payload="{\"embeds\":[{\"title\":\"${title}\",\"description\":\"${description}\",\"color\":${color},\"timestamp\":\"${ts}\",\"footer\":{\"text\":\"Grook CLI · ${host}\"}}]}"
  curl -sf -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null 2>&1 || true
}

# Couleurs embed Discord (entiers décimaux)
WH_GREEN=5763719    # 0x57F287
WH_RED=15548997     # 0xED4245
WH_YELLOW=16705372  # 0xFEE75C
WH_BLUE=5793266     # 0x5865F2
WH_PURPLE=10181046  # 0x9B59B6

# ── Version ───────────────────────────────────────────────────────────────────
get_version() {
  [[ -f "$VERSION_FILE" ]] || { echo "?"; return; }
  grep -oP "(?<=VERSION = ')[^']+" "$VERSION_FILE" 2>/dev/null || echo "?"
}

get_git_hash() {
  git rev-parse --short HEAD 2>/dev/null || echo "non-git"
}

get_git_msg() {
  git log -1 --format="%s" 2>/dev/null | cut -c1-60 || echo ""
}

# ── Process helpers ───────────────────────────────────────────────────────────
has_pm2()   { command -v pm2 &>/dev/null; }
has_jq()    { command -v jq  &>/dev/null; }

read_pid() {
  [[ -f "$PID_FILE" ]] && cat "$PID_FILE" || echo ""
}

is_running_bare() {
  local pid; pid=$(read_pid)
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

get_process_info() {
  local pid="$1"
  if [[ -f "/proc/${pid}/status" ]]; then
    # Linux
    local rss; rss=$(grep VmRSS /proc/"${pid}"/status 2>/dev/null | awk '{print $2}')
    local mem_mb=$(( rss / 1024 ))
    local cpu; cpu=$(ps -p "$pid" -o %cpu --no-headers 2>/dev/null | tr -d ' ' || echo "?")
    echo "${mem_mb}MB ${cpu}%"
  else
    # macOS / Git Bash
    local info; info=$(ps -p "$pid" -o rss,%cpu --no-headers 2>/dev/null || echo "? ?")
    local rss; rss=$(echo "$info" | awk '{print $1}')
    local cpu; cpu=$(echo "$info" | awk '{print $2}')
    local mem_mb=$(( rss / 1024 ))
    echo "${mem_mb}MB ${cpu}%"
  fi
}

get_uptime_str() {
  local pid="$1"
  local elapsed=0
  if [[ -f "/proc/${pid}/stat" ]]; then
    local btime start_ticks hz
    btime=$(grep -oP '(?<=btime )\d+' /proc/stat 2>/dev/null || echo 0)
    start_ticks=$(awk '{print $22}' "/proc/${pid}/stat" 2>/dev/null || echo 0)
    hz=$(getconf CLK_TCK 2>/dev/null || echo 100)
    elapsed=$(( $(date +%s) - btime - start_ticks / hz ))
  else
    # fallback via ps (macOS/Git Bash)
    local etime; etime=$(ps -p "$pid" -o etime --no-headers 2>/dev/null | tr -d ' ' || echo "")
    [[ -z "$etime" ]] && echo "?" && return
    # etime format: [[DD-]HH:]MM:SS
    local days=0 hours=0 mins=0 secs=0
    if [[ "$etime" =~ ^([0-9]+)-([0-9]+):([0-9]+):([0-9]+)$ ]]; then
      days=${BASH_REMATCH[1]}; hours=${BASH_REMATCH[2]}
      mins=${BASH_REMATCH[3]}; secs=${BASH_REMATCH[4]}
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
  [[ $m -gt 0 ]] && echo "${m}min ${s}s" && return
  echo "${s}s"
}

# ── Banner ────────────────────────────────────────────────────────────────────
banner() {
  local ver; ver=$(get_version)
  echo -e "${BOLD}${B}"
  echo '  ██████╗ ██████╗  ██████╗  ██████╗ ██╗  ██╗'
  echo ' ██╔════╝ ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝'
  echo ' ██║  ███╗██████╔╝██║   ██║██║   ██║█████╔╝ '
  echo ' ██║   ██║██╔══██╗██║   ██║██║   ██║██╔═██╗ '
  echo ' ╚██████╔╝██║  ██║╚██████╔╝╚██████╔╝██║  ██╗'
  echo '  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝'
  echo -e "${NC}  ${BOLD}v${ver}${NC} ${DIM}— by Root3301${NC}\n"
}

# ══════════════════════════════════════════════════════════════════════════════
# COMMANDES
# ══════════════════════════════════════════════════════════════════════════════

# ── install ───────────────────────────────────────────────────────────────────
cmd_install() {
  banner
  load_webhook
  step "Vérification des prérequis"

  command -v node &>/dev/null || die "Node.js introuvable. Installez Node ${MIN_NODE_MAJOR}+ : https://nodejs.org"
  local major; major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  (( major >= MIN_NODE_MAJOR )) || die "Node.js ${major} détecté — version ${MIN_NODE_MAJOR}+ requise."
  command -v npm &>/dev/null || die "npm introuvable."
  success "Node $(node -v) · npm $(npm -v)"

  # .env
  step "Configuration"
  if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
      cp ".env.example" ".env"
      warn ".env créé depuis .env.example — renseignez DISCORD_TOKEN !"
    fi
  else info ".env déjà présent."; fi

  mkdir -p data logs backups

  # PM2
  if has_pm2; then
    success "PM2 détecté ($(pm2 --version)) — gestion de processus avancée disponible."
  else
    warn "PM2 non installé. Recommandé pour un usage serveur : ${BOLD}npm install -g pm2${NC}"
  fi

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
  success "Installation terminée ! Éditez .env puis : ${BOLD}./grook.sh start${NC}"
}

# ── start ─────────────────────────────────────────────────────────────────────
cmd_start() {
  load_webhook
  [[ -f "package.json" ]] || die "Lancez ce script depuis la racine du projet."
  [[ -f ".env" ]] || die ".env introuvable. Lancez : ./grook.sh install"
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
      die "Le bot a crashé au démarrage. Consultez : ./grook.sh logs"
    fi
  fi

  send_webhook $WH_GREEN "🚀 Bot démarré" "**Grook Bot v${ver}** est en ligne sur \`$(hostname)\`\nCommit : \`${hash}\`"
}

# ── stop ──────────────────────────────────────────────────────────────────────
cmd_stop() {
  load_webhook
  local ver; ver=$(get_version)
  if has_pm2; then
    pm2 stop "$APP_NAME" 2>/dev/null && success "Bot arrêté (PM2)." || warn "PM2 : processus introuvable."
  else
    local pid; pid=$(read_pid)
    if [[ -z "$pid" ]]; then warn "Aucun PID — bot non démarré."; return; fi
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

# ── restart ───────────────────────────────────────────────────────────────────
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

# ── status ────────────────────────────────────────────────────────────────────
cmd_status() {
  local w=50
  echo ""
  box_top $w
  box_line $w "$(echo -e "${BOLD}  ⚙️  GROOK BOT — STATUT${NC}")"
  box_sep $w

  local ver; ver=$(get_version)
  local hash; hash=$(get_git_hash)
  local git_msg; git_msg=$(get_git_msg)

  if has_pm2; then
    local pm2_status; pm2_status=$(pm2 jlist 2>/dev/null | node -e "
      const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const p=d.find(x=>x.name==='${APP_NAME}');
      if(!p){console.log('offline|?|?|?');process.exit();}
      const uptime=p.pm2_env.pm_uptime;
      const elapsed=Date.now()-uptime;
      const s=Math.floor(elapsed/1000),m=Math.floor(s/60),h=Math.floor(m/60),d2=Math.floor(h/24);
      let up=d2>0?d2+'j '+h%24+'h':h>0?h+'h '+m%60+'min':m>0?m+'min '+s%60+'s':s+'s';
      console.log(p.pm2_env.status+'|'+up+'|'+(p.monit?.memory/1024/1024||0).toFixed(1)+'|'+(p.monit?.cpu||0));
    " 2>/dev/null || echo "unknown|?|?|?")
    IFS='|' read -r pm_status uptime mem cpu <<< "$pm2_status"
    local status_str
    case "$pm_status" in
      online)  status_str="${G}● EN LIGNE${NC}" ;;
      stopped) status_str="${Y}● ARRÊTÉ${NC}" ;;
      *)       status_str="${R}● ${pm_status^^}${NC}" ;;
    esac
    box_line $w "  Statut  : $(echo -e $status_str)  (PM2)"
    box_line $w "  Uptime  : ${uptime}"
    box_line $w "  RAM     : ${mem} MB   CPU : ${cpu}%"
  else
    local pid; pid=$(read_pid)
    if [[ -z "$pid" ]]; then
      box_line $w "  $(echo -e "${R}● ARRÊTÉ${NC}") (pas de PID)"
    elif kill -0 "$pid" 2>/dev/null; then
      local proc_info; proc_info=$(get_process_info "$pid")
      local mem; mem=$(echo "$proc_info" | awk '{print $1}')
      local cpu; cpu=$(echo "$proc_info" | awk '{print $2}')
      local uptime; uptime=$(get_uptime_str "$pid")
      box_line $w "  $(echo -e "${G}● EN LIGNE${NC}") (PID ${pid})"
      box_line $w "  Uptime  : ${uptime}"
      box_line $w "  RAM     : ${mem}   CPU : ${cpu}"
    else
      box_line $w "  $(echo -e "${R}● MORT${NC}") (PID ${pid} inexistant)"
      rm -f "$PID_FILE"
    fi
  fi

  box_sep $w
  box_line $w "  Version : v${ver}   Node : $(node -v 2>/dev/null || echo '?')"
  box_line $w "  Git     : ${hash}  ${DIM}${git_msg}${NC}"
  box_bot $w
  echo ""
}

# ── monitor ───────────────────────────────────────────────────────────────────
cmd_monitor() {
  command -v tput &>/dev/null || { warn "tput non disponible. Utilisez ./grook.sh status."; return; }
  local interval="${1:-2}"
  local iter=0

  trap 'tput rmcup; tput cnorm; echo -e "\n${G}Monitor fermé.${NC}"; exit 0' INT TERM

  tput smcup   # sauvegarde l'écran
  tput civis   # cache le curseur

  while true; do
    tput cup 0 0
    local ver; ver=$(get_version)
    local hash; hash=$(get_git_hash)
    local git_msg; git_msg=$(get_git_msg)
    local now; now=$(date '+%H:%M:%S')
    local W=60

    # ── Header ────────────────────────────────────────────────────────────────
    echo -e "${BOLD}${B}  ██████╗ ██████╗  ██████╗  ██████╗ ██╗  ██╗${NC}"
    echo -e "${BOLD}${B} ██╔════╝ ██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝  ${W}MONITOR${NC}"
    echo -e "${DIM}  Rafraîchissement toutes les ${interval}s · Ctrl+C pour quitter${NC}\n"

    # ── Statut ────────────────────────────────────────────────────────────────
    box_top $W
    printf "${DIM}│${NC} ${BOLD}%-*s${NC} ${DIM}│${NC}\n" $W "  ● STATUT"
    box_sep $W

    if has_pm2; then
      local pm2_json; pm2_json=$(pm2 jlist 2>/dev/null || echo "[]")
      local pm_status uptime mem cpu
      pm_status=$(echo "$pm2_json" | node -e "
        const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const p=d.find(x=>x.name==='${APP_NAME}');
        if(!p){console.log('offline');process.exit();}
        console.log(p.pm2_env.status);
      " 2>/dev/null || echo "offline")
      uptime=$(echo "$pm2_json" | node -e "
        const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
        const p=d.find(x=>x.name==='${APP_NAME}');
        if(!p||p.pm2_env.status!=='online'){console.log('—');process.exit();}
        const e=Date.now()-p.pm2_env.pm_uptime;
        const s=Math.floor(e/1000),m=Math.floor(s/60),h=Math.floor(m/60),d2=Math.floor(h/24);
        console.log(d2>0?d2+'j '+h%24+'h':h>0?h+'h '+m%60+'min':m>0?m+'min '+s%60+'s':s+'s');
      " 2>/dev/null || echo "?")
      mem=$(echo "$pm2_json"  | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const p=d.find(x=>x.name==='${APP_NAME}');console.log(p?.monit?.memory?(p.monit.memory/1024/1024).toFixed(1)+'MB':'?');" 2>/dev/null || echo "?")
      cpu=$(echo "$pm2_json"  | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const p=d.find(x=>x.name==='${APP_NAME}');console.log(p?.monit?.cpu!==undefined?p.monit.cpu+'%':'?');" 2>/dev/null || echo "?")

      local st_str
      [[ "$pm_status" == "online" ]]  && st_str="${G}● EN LIGNE${NC}  (PM2)" || st_str="${R}● ${pm_status^^}${NC}  (PM2)"
      box_line $W "  Statut  : $(echo -e "$st_str")"
      box_line $W "  Uptime  : ${uptime}"
      box_line $W "  RAM     : ${mem}    CPU : ${cpu}"
    else
      local pid; pid=$(read_pid)
      if [[ -z "$pid" ]]; then
        box_line $W "  $(echo -e "${R}● ARRÊTÉ${NC}") — pas de processus"
        box_line $W "  Lancez : ./grook.sh start"
      elif kill -0 "$pid" 2>/dev/null; then
        local pinfo; pinfo=$(get_process_info "$pid")
        local upt;   upt=$(get_uptime_str "$pid")
        box_line $W "  $(echo -e "${G}● EN LIGNE${NC}") — PID ${pid}"
        box_line $W "  Uptime  : ${upt}"
        box_line $W "  RAM     : $(echo "$pinfo"|awk '{print $1}')    CPU : $(echo "$pinfo"|awk '{print $2}')"
      else
        box_line $W "  $(echo -e "${R}● MORT${NC}") — PID ${pid} disparu"
        rm -f "$PID_FILE"
      fi
    fi

    box_sep $W
    printf "${DIM}│${NC} ${DIM}%-*s${NC} ${DIM}│${NC}\n" $W "  ▸ Infos"
    box_sep $W
    box_line $W "  Version : v${ver}   Node : $(node -v 2>/dev/null||echo '?')"
    box_line $W "  Git     : ${hash}  ${DIM}${git_msg}${NC}"
    [[ -f "$DB_FILE" ]] && {
      local db_size; db_size=$(du -sh "$DB_FILE" 2>/dev/null | awk '{print $1}')
      box_line $W "  DB      : grook.db (${db_size})"
    }

    # ── Logs récents ──────────────────────────────────────────────────────────
    box_sep $W
    printf "${DIM}│${NC} ${DIM}%-*s${NC} ${DIM}│${NC}\n" $W "  ▸ Logs récents"
    box_sep $W
    if [[ -f "$LOG_FILE" ]]; then
      while IFS= read -r line; do
        local trimmed="${line:0:$W}"
        printf "${DIM}│${NC}  ${DIM}%-*s${NC} ${DIM}│${NC}\n" $((W-1)) "$trimmed"
      done < <(tail -n 6 "$LOG_FILE" 2>/dev/null)
    else
      box_line $W "  (aucun log disponible)"
    fi
    box_bot $W

    printf "\n  ${DIM}Mis à jour à ${now} · itération #$((++iter))${NC}      \n"

    sleep "$interval"
  done
}

# ── health ────────────────────────────────────────────────────────────────────
cmd_health() {
  local issues=0
  echo ""
  echo -e "${BOLD}  🏥 Health Check — Grook Bot${NC}\n"

  # Node
  if command -v node &>/dev/null; then
    local major; major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
    if (( major >= MIN_NODE_MAJOR )); then
      echo -e "  ${G}✔${NC}  Node.js $(node -v)"
    else
      echo -e "  ${R}✖${NC}  Node.js $(node -v) — version ${MIN_NODE_MAJOR}+ requise"
      (( issues++ )) || true
    fi
  else
    echo -e "  ${R}✖${NC}  Node.js introuvable"; (( issues++ )) || true
  fi

  # .env
  if [[ -f ".env" ]]; then
    grep -q "DISCORD_TOKEN=.\+" .env 2>/dev/null \
      && echo -e "  ${G}✔${NC}  DISCORD_TOKEN configuré" \
      || { echo -e "  ${R}✖${NC}  DISCORD_TOKEN manquant dans .env"; (( issues++ )) || true; }
    grep -q "DISCORD_WEBHOOK_URL=.\+" .env 2>/dev/null \
      && echo -e "  ${G}✔${NC}  Webhook Discord configuré" \
      || echo -e "  ${Y}⚠${NC}  Webhook non configuré (optionnel)"
  else
    echo -e "  ${R}✖${NC}  .env manquant"; (( issues++ )) || true
  fi

  # node_modules
  [[ -d "node_modules" ]] \
    && echo -e "  ${G}✔${NC}  node_modules présent" \
    || { echo -e "  ${R}✖${NC}  node_modules absent — lancez : npm ci"; (( issues++ )) || true; }

  # DB
  [[ -f "$DB_FILE" ]] \
    && echo -e "  ${G}✔${NC}  Base de données : grook.db ($(du -sh "$DB_FILE" 2>/dev/null | awk '{print $1}'))" \
    || echo -e "  ${Y}⚠${NC}  Base de données absente (créée au 1er démarrage)"

  # PM2
  has_pm2 \
    && echo -e "  ${G}✔${NC}  PM2 $(pm2 --version) disponible" \
    || echo -e "  ${Y}⚠${NC}  PM2 non installé (recommandé)"

  # Statut processus
  if has_pm2; then
    local st; st=$(pm2 jlist 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const p=d.find(x=>x.name==='${APP_NAME}');console.log(p?.pm2_env?.status||'offline');" 2>/dev/null || echo "offline")
    [[ "$st" == "online" ]] \
      && echo -e "  ${G}✔${NC}  Bot en ligne (PM2)" \
      || { echo -e "  ${Y}⚠${NC}  Bot arrêté (PM2 : ${st})"; }
  elif is_running_bare; then
    echo -e "  ${G}✔${NC}  Bot en ligne (PID $(read_pid))"
  else
    echo -e "  ${Y}⚠${NC}  Bot non démarré"
  fi

  # Git
  if git rev-parse --git-dir &>/dev/null 2>&1; then
    local behind; behind=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "?")
    [[ "$behind" == "0" ]] \
      && echo -e "  ${G}✔${NC}  Git à jour ($(get_git_hash))" \
      || echo -e "  ${Y}⚠${NC}  ${behind} commit(s) en retard sur origin/main"
  fi

  echo ""
  if (( issues == 0 )); then
    echo -e "  ${G}${BOLD}✔  Tout est en ordre.${NC}"
  else
    echo -e "  ${R}${BOLD}✖  ${issues} problème(s) détecté(s).${NC}"
  fi
  echo ""
}

# ── logs ──────────────────────────────────────────────────────────────────────
cmd_logs() {
  local lines="${1:-50}"
  if has_pm2; then
    info "Logs PM2 (Ctrl+C pour quitter)…"
    pm2 logs "$APP_NAME" --lines "$lines"
  elif [[ -f "$LOG_FILE" ]]; then
    info "Dernières ${lines} lignes (Ctrl+C pour quitter)…"
    tail -n "$lines" -f "$LOG_FILE"
  else
    warn "Aucun fichier de log trouvé (${LOG_FILE})."
  fi
}

# ── update ────────────────────────────────────────────────────────────────────
cmd_update() {
  banner
  load_webhook
  step "Mise à jour de Grook Bot"

  git rev-parse --git-dir &>/dev/null || die "Pas un repo git. Mise à jour manuelle requise."

  local before; before=$(get_git_hash)
  local ver_before; ver_before=$(get_version)

  step "Sauvegarde de la base de données"
  cmd_backup quiet

  step "Récupération des modifications"
  spinner_start "git fetch…"
  if git fetch origin main &>/dev/null; then
    spinner_stop true "Fetch OK"
  else
    spinner_stop false "git fetch échoué"
    send_webhook $WH_RED "❌ Update échoué" "Échec du \`git fetch\` sur \`$(hostname)\`"
    die "Vérifiez la connexion ou les credentials git."
  fi

  local behind; behind=$(git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
  if [[ "$behind" == "0" ]]; then
    success "Déjà à jour ($(get_git_hash))."
    return
  fi

  spinner_start "git pull…"
  if git pull --ff-only origin main &>/dev/null; then
    spinner_stop true "Merge OK"
  else
    spinner_stop false "git pull échoué"
    send_webhook $WH_RED "❌ Update échoué" "Conflit git sur \`$(hostname)\` — intervention manuelle requise."
    die "Résolvez les conflits manuellement."
  fi

  local after; after=$(get_git_hash)
  local ver_after; ver_after=$(get_version)

  echo -e "\n  ${DIM}Commits :${NC}"
  git log --oneline "${before}..${after}" | while IFS= read -r l; do echo "    • $l"; done
  echo ""

  step "Mise à jour des dépendances"
  spinner_start "npm ci…"
  if npm ci --omit=dev > /tmp/grook_npm.log 2>&1; then
    spinner_stop true "Dépendances OK"
  else
    spinner_stop false "npm ci échoué"
    cat /tmp/grook_npm.log
    send_webhook $WH_RED "❌ Update échoué" "Échec \`npm ci\` sur \`$(hostname)\`"
    die "Vérifiez package.json et la connexion npm."
  fi

  step "Redémarrage"
  cmd_restart

  local changes; changes=$(git log --format="• %s" "${before}..${after}" | head -10 | tr '\n' '\n')
  send_webhook $WH_GREEN "🔄 Bot mis à jour" \
    "**v${ver_before}** → **v${ver_after}** sur \`$(hostname)\`\n\`${before}\` → \`${after}\`\n\n${changes}"

  success "Mise à jour terminée ! ${before} → ${after}"
}

# ── backup ────────────────────────────────────────────────────────────────────
cmd_backup() {
  load_webhook
  local quiet="${1:-}"
  mkdir -p "$BACKUP_DIR"

  if [[ ! -f "$DB_FILE" ]]; then
    [[ -z "$quiet" ]] && warn "Base de données introuvable — rien à sauvegarder."
    return
  fi

  local ts; ts=$(date +"%Y%m%d-%H%M%S")
  local dest="${BACKUP_DIR}/grook-${ts}.db"
  cp "$DB_FILE" "$dest"

  local size; size=$(du -sh "$dest" 2>/dev/null | awk '{print $1}')
  [[ -z "$quiet" ]] && success "Backup créé : ${dest} (${size})"

  # Rotation : garde les 10 derniers
  local count; count=$(ls -1 "${BACKUP_DIR}"/grook-*.db 2>/dev/null | wc -l)
  if (( count > 10 )); then
    local to_del=$(( count - 10 ))
    ls -1t "${BACKUP_DIR}"/grook-*.db | tail -n "$to_del" | xargs rm -f
    [[ -z "$quiet" ]] && info "${to_del} ancien(s) backup(s) supprimé(s)."
  fi

  [[ -z "$quiet" ]] && send_webhook $WH_BLUE "💾 Backup créé" \
    "Sauvegarde \`${dest}\` (${size}) sur \`$(hostname)\`"
}

# ── config-show ───────────────────────────────────────────────────────────────
cmd_config_show() {
  [[ -f ".env" ]] || { warn ".env introuvable."; return; }
  echo ""
  echo -e "${BOLD}  📋 Configuration .env${NC}\n"
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && echo -e "  ${DIM}${line}${NC}" && continue
    local key val
    key=$(echo "$line" | cut -d= -f1)
    val=$(echo "$line" | cut -d= -f2-)
    # Masquer les tokens/clés sensibles
    if echo "$key" | grep -qiE 'TOKEN|KEY|SECRET|PASSWORD|WEBHOOK'; then
      local masked="${val:0:6}$(printf '*%.0s' $(seq 1 $((${#val}-10))))${val: -4}"
      [[ ${#val} -lt 10 ]] && masked="***"
      echo -e "  ${C}${key}${NC}=${Y}${masked}${NC}"
    else
      echo -e "  ${C}${key}${NC}=${G}${val}${NC}"
    fi
  done < .env
  echo ""
}

# ── webhook-test ──────────────────────────────────────────────────────────────
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

# ── version ───────────────────────────────────────────────────────────────────
cmd_version() {
  local ver; ver=$(get_version)
  local hash; hash=$(get_git_hash)
  echo -e "${BOLD}Grook Bot v${ver}${NC} (${hash})"
  node --version | xargs printf "Node.js %s\n"
  npm  --version | xargs printf "npm    v%s\n"
  has_pm2 && pm2 --version | xargs printf "PM2    v%s\n" || true
}

# ── dev ───────────────────────────────────────────────────────────────────────
cmd_dev() {
  [[ -f ".env" ]] || die ".env introuvable."
  info "Mode développement (--watch, rechargement automatique)…"
  node --watch src/index.js
}

# ── help ──────────────────────────────────────────────────────────────────────
cmd_help() {
  banner
  echo -e "${BOLD}Usage :${NC}  ./grook.sh <commande> [options]\n"

  local W=62
  box_top $W
  printf "${DIM}│${NC} ${BOLD}%-*s${NC} ${DIM}│${NC}\n" $W " 🚀 Cycle de vie"
  box_sep $W
  box_line $W "  ${G}install${NC}         Installe les dépendances, .env, dossiers"
  box_line $W "  ${G}start${NC}           Démarre le bot (PM2 ou bare-node)"
  box_line $W "  ${G}stop${NC}            Arrête le bot"
  box_line $W "  ${G}restart${NC}         Redémarre le bot"
  box_line $W "  ${G}dev${NC}             Mode dev (node --watch)"
  box_sep $W
  printf "${DIM}│${NC} ${BOLD}%-*s${NC} ${DIM}│${NC}\n" $W " 📊 Monitoring"
  box_sep $W
  box_line $W "  ${G}status${NC}          Statut rapide du bot"
  box_line $W "  ${G}monitor${NC} [sec]   Dashboard temps réel (défaut : 2s)"
  box_line $W "  ${G}health${NC}          Diagnostic complet de l'installation"
  box_line $W "  ${G}logs${NC} [N]        Dernières N lignes de log (défaut : 50)"
  box_sep $W
  printf "${DIM}│${NC} ${BOLD}%-*s${NC} ${DIM}│${NC}\n" $W " 🔧 Maintenance"
  box_sep $W
  box_line $W "  ${G}update${NC}          git pull + npm ci + backup + restart"
  box_line $W "  ${G}backup${NC}          Sauvegarde la DB (rotation 10 derniers)"
  box_line $W "  ${G}config${NC}          Affiche la configuration .env (masquée)"
  box_line $W "  ${G}webhook-test${NC}    Teste la notification Discord webhook"
  box_line $W "  ${G}version${NC}         Versions du bot, Node, npm, PM2"
  box_sep $W
  printf "${DIM}│${NC} ${DIM}%-*s${NC} ${DIM}│${NC}\n" $W "  PM2 recommandé : npm install -g pm2"
  printf "${DIM}│${NC} ${DIM}%-*s${NC} ${DIM}│${NC}\n" $W "  Webhook  : DISCORD_WEBHOOK_URL= dans .env"
  box_bot $W
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# DISPATCH
# ══════════════════════════════════════════════════════════════════════════════
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  install)       cmd_install       ;;
  start)         cmd_start         ;;
  stop)          cmd_stop          ;;
  restart)       cmd_restart       ;;
  status)        cmd_status        ;;
  monitor)       cmd_monitor "${1:-2}" ;;
  health)        cmd_health        ;;
  logs)          cmd_logs "${1:-50}" ;;
  update)        cmd_update        ;;
  backup)        cmd_backup        ;;
  config)        cmd_config_show   ;;
  webhook-test)  cmd_webhook_test  ;;
  version)       cmd_version       ;;
  dev)           cmd_dev           ;;
  help|--help|-h) cmd_help        ;;
  *)
    error "Commande inconnue : '${COMMAND}'"
    echo -e "  Lancez ${BOLD}./grook.sh help${NC} pour la liste complète."
    exit 1
    ;;
esac
