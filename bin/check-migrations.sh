#!/usr/bin/env bash
# Verifica que un rango de commits no toque migraciones que ya existen.
# Lo corre el CI (.github/workflows/ci.yml) en cada PR y en cada push.
#
#   bin/check-migrations.sh <base> [<head>]     (head default: HEAD)
#
# Una migración ya aplicada no se vuelve a correr, así que editarla, borrarla o
# renombrarla deja a producción distinta de una base nueva. Lo único permitido
# en database/migrations/ es agregar archivos nuevos, y cada uno tiene que:
#   - llamarse NNNN_nombre.sql (si no, bin/migrate.php lo ignora sin avisar),
#   - tener un número que no exista ya (si se repite, uno pisa al otro),
#   - ir después de la última migración de la base (si no, en una base que ya
#     corrió las siguientes no se aplica nunca).
set -euo pipefail

# Si base o head no existen, git falla dentro de los < <(...) sin cortar el
# script: mejor fallar acá con un error claro.

base="${1:?uso: check-migrations.sh <base> [<head>]}"
head="${2:-HEAD}"
dir=database/migrations
fail=0

for ref in "$base" "$head"; do
  git rev-parse --verify -q "$ref^{commit}" > /dev/null || { echo "::error::No existe el commit $ref"; exit 2; }
done

err() { echo "::error file=$1::$2"; fail=1; }

# Archivos de la base modificados, borrados o renombrados.
while IFS=$'\t' read -r status path _; do
  case "$status" in
    A) ;;
    M) err "$path" "Se modificó una migración existente ($path). Creá una migración nueva con el número siguiente." ;;
    D) err "$path" "Se borró una migración existente ($path). Si hay que deshacerla, hacelo con una migración nueva." ;;
    R*|C*) err "$path" "Se renombró una migración existente ($path). El número y el nombre de una migración aplicada no cambian." ;;
    *) err "$path" "Cambio no permitido en una migración existente ($status $path)." ;;
  esac
done < <(git diff --name-status -M "$base" "$head" -- "$dir")

# Archivos nuevos: nombre, número único y orden.
last="$(git ls-tree --name-only "$base" -- "$dir/" | xargs -rn1 basename | grep -oE '^[0-9]{4}' | sort | tail -1 || true)"
mapfile -t added < <(git diff --name-only --diff-filter=A "$base" "$head" -- "$dir")
for path in "${added[@]}"; do
  name="$(basename "$path")"
  if ! [[ "$name" =~ ^([0-9]{4})_[A-Za-z0-9_-]+\.sql$ ]]; then
    err "$path" "Nombre inválido: tiene que ser NNNN_nombre.sql (ej. 0015_agrega_columna.sql)."
    continue
  fi
  num="${BASH_REMATCH[1]}"
  if [ -n "$last" ] && ! [ "$num" \> "$last" ]; then
    err "$path" "El número $num no va después de la última migración ($last). Usá el siguiente."
  fi
done

dups="$(git ls-tree --name-only "$head" -- "$dir/" | xargs -rn1 basename | grep -oE '^[0-9]{4}' | sort | uniq -d)"
for num in $dups; do
  err "$dir" "Hay más de una migración con el número $num."
done

if [ "$fail" -eq 0 ]; then
  echo "Migraciones OK: ${#added[@]} nueva(s), ninguna existente modificada."
fi
exit "$fail"
