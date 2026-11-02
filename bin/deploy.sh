#!/usr/bin/env bash
# Redeploy en el VPS: trae lo último de la rama, reconstruye y verifica que la
# app responda. Lo corre GitHub Actions por SSH (.github/workflows/deploy.yml)
# cuando el CI de main (o dev) termina en verde, pero también sirve a mano:
#
#   /opt/UTN-Tracker/prod/bin/deploy.sh prod      # main -> /opt/UTN-Tracker/prod
#   /opt/UTN-Tracker/prod/bin/deploy.sh staging   # dev  -> /opt/UTN-Tracker/dev
#
# Pensado para usarse como "forced command" de una clave SSH dedicada
# (command="..." en ~/.ssh/authorized_keys): en ese caso el destino llega en
# SSH_ORIGINAL_COMMAND y cualquier otra cosa que se pida se rechaza, así que esa
# clave solo puede deployar, no abrir una shell.
#
# Variables (opcionales):
#   PROD_DIR, STAGING_DIR   carpetas de cada entorno (defaults de arriba)
#   HEALTH_TIMEOUT          segundos a esperar que la app responda (default 90)
#
# Todo el script está dentro de main() a propósito: el `git merge` de abajo puede
# reescribir este mismo archivo mientras corre, y bash lee los scripts de a
# pedazos. Con la función, bash ya parseó todo antes de que eso pase.
set -euo pipefail

main() {
  local target="${1:-${SSH_ORIGINAL_COMMAND:-}}"
  local dir branch
  case "$target" in
    prod)    dir="${PROD_DIR:-/opt/UTN-Tracker/prod}";   branch=main ;;
    staging) dir="${STAGING_DIR:-/opt/UTN-Tracker/dev}"; branch=dev ;;
    *)
      echo "uso: deploy.sh prod|staging (recibido: '${target}')" >&2
      exit 2
      ;;
  esac

  if [ ! -d "$dir/.git" ]; then
    echo "deploy: $dir no es un clon del repo (¿${target} no está instalado en este VPS?)" >&2
    exit 1
  fi
  cd "$dir"

  # Un deploy por entorno a la vez: si llegan dos pushes seguidos, el segundo
  # espera a que termine el primero en vez de pisarle el build.
  exec 9>"/tmp/utntracker-deploy-${target}.lock"
  flock 9

  log "==> $target: $(pwd), rama $branch"

  git fetch --prune origin "$branch"
  local before after
  before="$(git rev-parse HEAD)"
  # Vuelve a la rama por si quedó otra checkouteada (p. ej. un PR en staging).
  git checkout -q "$branch"
  # --ff-only: si alguien editó archivos del repo en el VPS o la rama local
  # divergió, corta con error en vez de pisar nada. El .env no se toca (está
  # ignorado por git).
  git merge --ff-only -q "origin/$branch"
  after="$(git rev-parse HEAD)"

  if [ "$before" = "$after" ]; then
    log "    sin commits nuevos ($(git log -1 --format='%h %s'))"
  else
    log "    $(git rev-parse --short "$before") -> $(git rev-parse --short "$after")"
    git --no-pager log --format='      %h %s' "$before..$after" | head -20
  fi

  # En prod, backup de la base antes de que el contenedor nuevo corra migraciones.
  if [ "$target" = prod ] && [ -x bin/backup-db.sh ] && docker compose ps --status running -q db | grep -q .; then
    log "==> backup de la base"
    bin/backup-db.sh
  fi

  log "==> build y up"
  docker compose up -d --build --remove-orphans

  log "==> esperando que la app responda"
  wait_healthy "${HEALTH_TIMEOUT:-90}"

  # Cada build deja la imagen anterior sin tag: sin esto el disco se llena solo.
  docker image prune -f > /dev/null

  log "==> $target deployado en $(git log -1 --format='%h %s')"
}

# La app no publica puertos al host, así que se prueba desde adentro del
# contenedor. /api/careers pasa por PHP y por la base: si respondió, Apache,
# las migraciones y la conexión a MySQL están bien.
wait_healthy() {
  local timeout="$1" waited=0
  until docker compose exec -T app php -r \
      'exit(@file_get_contents("http://127.0.0.1/api/careers") === false ? 1 : 0);' 2>/dev/null; do
    if [ "$waited" -ge "$timeout" ]; then
      echo "deploy: la app no respondió en ${timeout}s. Últimos logs:" >&2
      docker compose logs --tail 40 app >&2 || true
      exit 1
    fi
    sleep 3
    waited=$((waited + 3))
  done
}

log() { printf '%s\n' "$*"; }

main "$@"
exit
