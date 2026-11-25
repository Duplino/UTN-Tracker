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
  # espera a que termine el primero en vez de pisarle el build. Si este script se
  # relanzó a sí mismo (ver abajo), el lock ya lo tiene tomado en el fd 9.
  if [ -z "${DEPLOY_REEXEC:-}" ]; then
    exec 9>"/tmp/utntracker-deploy-${target}.lock"
    flock 9
  fi

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

  # Si el pull trajo cambios en este mismo script, lo que está corriendo es la
  # versión vieja (bash ya la tenía parseada). Se relanza con la nueva para que el
  # deploy siga los pasos nuevos (p. ej. cuando se agregó APP_VERSION, el primer
  # deploy salió como "dev" por esto).
  if [ -z "${DEPLOY_REEXEC:-}" ] && ! git diff --quiet "$before" "$after" -- bin/deploy.sh; then
    log "    bin/deploy.sh cambió: relanzando con la versión nueva"
    DEPLOY_REEXEC=1 exec bash "$dir/bin/deploy.sh" "$target"
  fi

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

  # Versión = número del último PR mergeado (se ve en Configuración y en /version.json).
  export APP_VERSION APP_COMMIT
  APP_VERSION="$(app_version)"
  APP_COMMIT="$(git rev-parse HEAD)"

  log "==> build y up (versión $APP_VERSION, ${APP_COMMIT:0:12})"
  docker compose up -d --build --remove-orphans

  log "==> esperando que la app responda"
  wait_healthy "${HEALTH_TIMEOUT:-90}"
  check_version "$APP_COMMIT"

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

# Número del último PR en la historia de la rama: el subject de un merge ("Merge pull
# request #81 from ...") o de un squash ("Título (#77)"). Sin ninguno, "0".
app_version() {
  local subjects
  subjects="$(git log --first-parent --format=%s -500)"
  printf '%s\n' "$subjects" \
    | sed -nE 's/^Merge pull request #([0-9]+).*/\1/p; t; s/.*\(#([0-9]+)\)[[:space:]]*$/\1/p' \
    | sed -n 1p | grep . || echo 0
}

# El contenedor nuevo tiene que estar sirviendo el commit que se acaba de buildear.
check_version() {
  local served
  served="$(docker compose exec -T app php -r \
      'echo json_decode((string) @file_get_contents("http://127.0.0.1/version.json"), true)["commit"] ?? "";' 2>/dev/null || true)"
  if [ "$served" != "$1" ]; then
    echo "deploy: /version.json dice commit '${served}', se esperaba '$1'" >&2
    exit 1
  fi
  log "    /version.json ok"
}

log() { printf '%s\n' "$*"; }

main "$@"
exit
