#!/usr/bin/env bash
# ¿La app desplegada está en la última versión? Compara el commit que sirve el
# servidor (/version.json) con el último commit de main en GitHub. Solo usa curl.
#
#   bin/check-version.sh                                     # producción
#   bin/check-version.sh https://staging.utntracker.com.ar dev
#
# Sale con 0 si está al día y con 1 si no (sirve para scripts). Ojo: después de
# mergear un PR, el CI más el deploy tardan unos minutos en llegar.
set -euo pipefail

url="${1:-https://app.utntracker.com.ar}"
branch="${2:-main}"
repo="Duplino/UTN-Tracker"

json_field() { sed -nE "s/.*\"$1\": *\"([^\"]*)\".*/\1/p" | head -1; }

server="$(curl -fsS -H 'Cache-Control: no-cache' "${url%/}/version.json?t=$(date +%s)")"
server_version="$(printf '%s' "$server" | json_field version)"
server_commit="$(printf '%s' "$server" | json_field commit)"

head="$(curl -fsS -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$repo/commits/$branch")"
head_sha="$(printf '%s' "$head" | json_field sha)"
head_msg="$(printf '%s' "$head" | sed -nE 's/.*"message": *"([^"]*)".*/\1/p' | head -1)"
head_pr="$(printf '%s' "$head_msg" | sed -nE 's/^Merge pull request #([0-9]+).*/\1/p; t; s/.*\(#([0-9]+)\)(\\n.*)?$/\1/p')"

echo "Servidor ($url): versión ${server_version:-?} (${server_commit:0:12})"
echo "GitHub ($branch):  versión ${head_pr:-?} (${head_sha:0:12})"

if [ -n "$server_commit" ] && [ "$server_commit" = "$head_sha" ]; then
  echo "OK: la app está en la última versión."
else
  echo "DESACTUALIZADA: el deploy está pendiente o falló (ver Actions > Deploy)."
  exit 1
fi
