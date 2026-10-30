#!/usr/bin/env sh
# Backup de la base MySQL que corre en docker compose. Pensado para cron en el VPS:
#
#   15 4 * * * /opt/UTN-Tracker/prod/bin/backup-db.sh >> /var/log/utntracker-backup.log 2>&1
#
# Variables (todas opcionales):
#   COMPOSE_FILE    compose a usar (default: docker-compose.prod.yml)
#   BACKUP_DIR      dónde dejar los .sql.gz (default: <repo>/backups)
#   RETENTION_DAYS  cuántos días conservar (default: 14)
#
# Usa DB / DB_USER / DB_PASSWORD del .env del repo. Para restaurar:
#   gunzip -c backups/utn_tracker-AAAAMMDD-HHMM.sql.gz | docker compose -f docker-compose.prod.yml exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
set -eu

cd "$(dirname "$0")/.."
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
name="${DB:-$(grep -E '^DB=' .env | cut -d= -f2-)}"
out="$BACKUP_DIR/${name:-db}-$(date +%Y%m%d-%H%M).sql.gz"

# Las credenciales se leen dentro del contenedor (MYSQL_USER/MYSQL_PASSWORD) para
# no pasarlas por la línea de comandos del host.
docker compose -f "$COMPOSE_FILE" exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces --routines -u"$MYSQL_USER" "$MYSQL_DATABASE"' \
  | gzip > "$out.tmp"

# sh no tiene pipefail: se verifica que el dump haya terminado completo.
if ! gunzip -c "$out.tmp" | tail -n 1 | grep -q 'Dump completed'; then
  rm -f "$out.tmp"
  echo "$(date '+%F %T') backup FALLÓ: el dump quedó incompleto" >&2
  exit 1
fi
mv "$out.tmp" "$out"

find "$BACKUP_DIR" -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "$(date '+%F %T') backup ok: $out ($(du -h "$out" | cut -f1))"
