#!/usr/bin/env bash
#
# Déploiement / mise à jour de la plateforme sur le serveur.
#
#     sudo -u bootcamp /srv/bootcamp/app/platform-app/deploy/deploy.sh
#
# Idempotent : relançable à volonté. Il tire le code, reconstruit ce qui a
# changé, migre, réimporte le contenu, puis redémarre l'API.
set -euo pipefail

ROOT=/srv/bootcamp
APP="$ROOT/app"
BACKEND="$APP/platform-app/backend"
FRONTEND="$APP/platform-app/frontend"
WEBROOT="$ROOT/frontend"

log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------- code
log "Récupération du code"
cd "$APP"
git fetch --quiet origin
git reset --hard --quiet origin/main
git log -1 --format='  %h %s'

# ------------------------------------------------------------- backend
log "Dépendances Python"
cd "$BACKEND"
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

set -a
# shellcheck disable=SC1091
source "$ROOT/bootcamp.env"
set +a

log "Migrations"
.venv/bin/python manage.py migrate --noinput

log "Import du contenu depuis les notebooks"
.venv/bin/python manage.py import_content

log "Fichiers statiques Django (admin, DRF)"
.venv/bin/python manage.py collectstatic --noinput --clear

log "Contrôle de configuration"
.venv/bin/python manage.py check --deploy --fail-level ERROR

# ------------------------------------------------------------ frontend
log "Construction du frontend"
cd "$FRONTEND"
npm ci --silent
npm run build

log "Publication du frontend"
mkdir -p "$WEBROOT"
rsync -a --delete "$FRONTEND/dist/" "$WEBROOT/"

# ------------------------------------------------------------- service
log "Redémarrage de l'API"
sudo systemctl restart bootcamp-api
sleep 2
systemctl is-active --quiet bootcamp-api && echo "  API active" || {
	echo "  ❌ l'API n'a pas redémarré"
	journalctl -u bootcamp-api -n 30 --no-pager
	exit 1
}

log "Vérification de bout en bout"
.venv/bin/python "$BACKEND/scripts/smoke_test.py" \
	--base "https://${DJANGO_ALLOWED_HOSTS%%,*}/api" \
	--frontend "https://${DJANGO_ALLOWED_HOSTS%%,*}"

log "Déployé."
