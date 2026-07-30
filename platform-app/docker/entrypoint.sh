#!/usr/bin/env bash
#
# Prépare l'application puis passe la main à la commande du conteneur.
#
# Idempotent : migre à chaque démarrage, mais n'importe les 36 notebooks que si
# le catalogue est vide. Un redémarrage est donc quasi instantané.
set -euo pipefail

log() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }

mkdir -p "$(dirname "${SQLITE_PATH:-/data/db.sqlite3}")"

log "Migrations"
python manage.py migrate --noinput

NEEDS_IMPORT=$(python - <<'PY'
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from catalog.models import Module

print("1" if Module.objects.count() == 0 else "0")
PY
)

if [ "$NEEDS_IMPORT" = "1" ] || [ "${BOOTCAMP_REIMPORT:-0}" = "1" ]; then
    log "Import du contenu depuis les notebooks"
    python manage.py import_content
else
    log "Contenu déjà en base — import ignoré (BOOTCAMP_REIMPORT=1 pour forcer)"
fi

log "Fichiers statiques"
python manage.py collectstatic --noinput > /dev/null

# Compte d'administration facultatif, créé une seule fois.
if [ -n "${DJANGO_SUPERUSER_EMAIL:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
    log "Compte administrateur"
    python - <<'PY'
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from accounts.models import User

email = os.environ["DJANGO_SUPERUSER_EMAIL"]
if User.objects.filter(email=email).exists():
    print(f"  existe déjà : {email}")
else:
    User.objects.create_superuser(
        email=email,
        username=os.environ.get("DJANGO_SUPERUSER_USERNAME", email.split("@")[0]),
        password=os.environ["DJANGO_SUPERUSER_PASSWORD"],
    )
    print(f"  créé : {email}")
PY
fi

log "Démarrage"
exec "$@"
