# Image unique : le frontend est construit puis servi par Django.
#
# Un seul processus, un seul port, aucun reverse proxy à configurer — c'est ce
# qui permet un `docker compose up` qui marche du premier coup sur n'importe
# quel poste. Le contexte de build est la racine du dépôt, parce que l'import du
# contenu a besoin de `notebooks/`.
#
#   docker build -f platform-app/Dockerfile -t bootcamp-de .

# ─────────────────────────────────────────────────────────── 1. frontend
FROM node:22-alpine AS frontend

WORKDIR /build

# Les dépendances d'abord : cette couche ne se reconstruit que si les
# manifestes changent, pas à chaque modification de composant.
COPY platform-app/frontend/package.json platform-app/frontend/package-lock.json ./

# `npm ci` d'abord, pour l'installation reproductible. Le repli sur `npm install`
# couvre un cas réel : les dépendances WASM imbriquées de @tailwindcss/oxide
# (@emnapi/*) ne sont jamais résolues dans le lock généré sur une plateforme qui
# dispose du binaire natif, donc `npm ci` les déclare manquantes et refuse de
# tourner. Le repli garde le build fonctionnel sans masquer ce qui s'est passé.
#
# `--ignore-scripts` : le postinstall copie sql-wasm.wasm dans public/, qui
# n'existe pas encore à ce stade. La copie est refaite juste après.
RUN npm ci --ignore-scripts --no-audit --no-fund \
    || { echo "→ lock incomplet pour npm ci, repli sur npm install"; \
         npm install --ignore-scripts --no-audit --no-fund; }

COPY platform-app/frontend/ ./
RUN cp node_modules/sql.js/dist/sql-wasm.wasm public/ \
    && npm run build

# ──────────────────────────────────────────────────────────── 2. runtime
FROM python:3.12-slim AS runtime

# Port interne inhabituel : rien n'écoute sur 8000, ni dans le conteneur ni sur
# l'hôte, ce qui évite les collisions avec les serveurs de développement.
# Surchargeable au lancement (`-e APP_PORT=…`) sans reconstruire l'image.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=config.settings \
    SPA_ROOT=/app/platform-app/backend/spa \
    SQLITE_PATH=/data/db.sqlite3 \
    APP_PORT=8011

# sqlite3 pour les sauvegardes (`.backup`), curl pour le healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends sqlite3 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/platform-app/backend

COPY platform-app/backend/requirements.txt ./
RUN pip install -r requirements.txt

# Le code applicatif et le contenu. `REPO_ROOT` remonte de deux niveaux depuis
# le backend, donc les notebooks doivent être en /app/notebooks.
COPY platform-app/backend/ /app/platform-app/backend/
COPY notebooks/ /app/notebooks/

# Le bundle construit à l'étape précédente.
COPY --from=frontend /build/dist/ /app/platform-app/backend/spa/

COPY platform-app/docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Utilisateur sans privilèges. Docker recopie les droits de /data dans un volume
# nommé vide à sa création, donc la base est écrivable sans bascule d'identité
# au démarrage. (Un bind mount, lui, garde les droits de l'hôte : voir le guide.)
RUN useradd --system --create-home --shell /bin/bash bootcamp \
    && mkdir -p /data /app/platform-app/backend/staticfiles \
    && chown -R bootcamp:bootcamp /data /app

USER bootcamp

EXPOSE 8011
VOLUME ["/data"]

# Forme shell pour que $APP_PORT soit résolu à l'exécution : le port reste
# modifiable sans reconstruire l'image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${APP_PORT}/api/stats/" > /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# `exec` à l'intérieur du shell : gunicorn remplace le shell et reçoit donc
# bien SIGTERM au `docker stop`, sans quoi l'arrêt attendrait le délai de grâce.
CMD ["sh", "-c", "exec gunicorn config.wsgi:application \
     --bind 0.0.0.0:${APP_PORT} \
     --workers ${GUNICORN_WORKERS:-2} \
     --threads ${GUNICORN_THREADS:-4} \
     --timeout 60 \
     --access-logfile - \
     --error-logfile -"]
