#!/usr/bin/env bash
#
# Sauvegarde de la base SQLite, conservée 14 jours.
# Installer en cron quotidien :
#   0 3 * * * /srv/bootcamp/app/platform-app/deploy/backup.sh
set -euo pipefail

DATA=/srv/bootcamp/data
BACKUPS=/srv/bootcamp/backups
STAMP=$(date +%Y-%m-%d_%H%M)

mkdir -p "$BACKUPS"

# `.backup` prend un instantané cohérent même pendant une écriture — copier le
# fichier avec cp donnerait une base corrompue si une transaction est en cours.
sqlite3 "$DATA/db.sqlite3" ".backup '$BACKUPS/db-$STAMP.sqlite3'"
gzip -f "$BACKUPS/db-$STAMP.sqlite3"

find "$BACKUPS" -name 'db-*.sqlite3.gz' -mtime +14 -delete

echo "Sauvegarde : $BACKUPS/db-$STAMP.sqlite3.gz ($(du -h "$BACKUPS/db-$STAMP.sqlite3.gz" | cut -f1))"
