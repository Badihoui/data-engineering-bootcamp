# Lancer la plateforme avec Docker

Objectif : la plateforme qui tourne sur **n'importe quel PC** — Linux, macOS, Windows — avec
une seule commande, sans installer Python ni Node.

---

## En une commande

```bash
git clone https://github.com/Badihoui/data-engineering-bootcamp.git
cd data-engineering-bootcamp
docker compose up --build
```

Puis ouvrir **<http://localhost:8000>**.

Le premier démarrage prend deux à trois minutes : Docker construit le frontend, installe les
dépendances Python, applique les migrations et importe les 36 notebooks. Les démarrages
suivants prennent **environ 6 secondes** — le contenu déjà en base n'est pas réimporté.

```bash
docker compose up -d       # en arrière-plan
docker compose logs -f     # suivre les journaux
docker compose down        # arrêter (les données sont conservées)
```

---

## Ce que contient l'image

| | |
|---|---|
| Taille | **221 Mo** |
| Processus | un seul (gunicorn, 2 workers × 4 threads) |
| Port | 8000 |
| Base | SQLite dans le volume `bootcamp-data` |
| Utilisateur | `bootcamp`, sans privilèges |

Django sert **à la fois l'API et le frontend construit**. C'est ce qui permet un seul port et
aucun reverse proxy à configurer : WhiteNoise diffuse les assets hachés, et une vue de repli
renvoie `index.html` pour les routes React — sans quoi un rechargement de `/app/revision`
donnerait un 404.

Les ateliers (terminal bash, SQLite, Python) s'exécutent dans le navigateur, pas dans le
conteneur : l'image reste légère et la charge serveur négligeable.

---

## Créer un compte

Deux possibilités.

**Par l'interface** : cliquer sur « Créer un compte » sur <http://localhost:8000>.

**Un administrateur au démarrage**, en créant un fichier `.env` à la racine :

```ini
DJANGO_SUPERUSER_EMAIL=moi@exemple.fr
DJANGO_SUPERUSER_PASSWORD=UnMotDePasseSolide2026!
```

Puis `docker compose up -d`. Le compte est créé une seule fois et donne accès à
<http://localhost:8000/admin/>.

---

## Réglages

Toutes les variables se placent dans un `.env` à la racine du dépôt.

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `8000` | port sur l'hôte |
| `DJANGO_SECRET_KEY` | clé locale | **à changer** dès que l'application sort de localhost |
| `DJANGO_DEBUG` | `0` | `1` pour les pages d'erreur détaillées |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,…` | à compléter pour un accès réseau |
| `DJANGO_SUPERUSER_EMAIL` / `_PASSWORD` | — | crée un admin au premier démarrage |
| `BOOTCAMP_REIMPORT` | `0` | `1` pour réimporter les notebooks au prochain démarrage |
| `POSTGRES_PASSWORD` | `bootcamp` | avec le profil `postgres` uniquement |

Exemple pour changer de port :

```bash
echo "PORT=9000" > .env
docker compose up -d          # → http://localhost:9000
```

---

## Accéder depuis un autre appareil du réseau

Utile pour tester sur téléphone ou tablette. Récupérer l'IP locale de la machine, puis :

```ini
# .env
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.42
DJANGO_CSRF_TRUSTED_ORIGINS=http://192.168.1.42:8000
CORS_ALLOWED_ORIGINS=http://192.168.1.42:8000
```

```bash
docker compose up -d
```

L'application est alors sur `http://192.168.1.42:8000` depuis n'importe quel appareil du même
réseau.

---

## Mettre à jour le contenu

Après avoir modifié un notebook :

```bash
BOOTCAMP_REIMPORT=1 docker compose up -d --build
```

Puis remettre `BOOTCAMP_REIMPORT` à `0`, sinon chaque démarrage réimporte les 36 notebooks
pour rien.

Réimport sans reconstruire l'image :

```bash
docker compose exec app python manage.py import_content
```

---

## Commandes utiles

```bash
# Console Django
docker compose exec app python manage.py shell

# Créer un administrateur à la main
docker compose exec app python manage.py createsuperuser

# Couverture de conversion des schémas
docker compose exec app python manage.py diagram_report

# Suite de tests dans le conteneur
docker compose exec app python manage.py test

# Vérification de bout en bout
docker compose exec app python scripts/smoke_test.py \
    --base http://127.0.0.1:8000/api --frontend http://127.0.0.1:8000
```

### Sauvegarder et restaurer la base

```bash
# Sauvegarde — `.backup` prend un instantané cohérent même pendant une écriture,
# contrairement à une simple copie du fichier.
docker compose exec app sqlite3 /data/db.sqlite3 ".backup '/data/sauvegarde.sqlite3'"
docker compose cp app:/data/sauvegarde.sqlite3 ./sauvegarde-$(date +%F).sqlite3

# Restauration
docker compose cp ./sauvegarde-2026-07-30.sqlite3 app:/data/db.sqlite3
docker compose restart app
```

### Repartir de zéro

```bash
docker compose down -v        # ⚠️ -v supprime le volume, donc toutes les données
docker compose up --build
```

---

## PostgreSQL (optionnel)

SQLite suffit largement : le contenu est écrit une fois puis lu. Le profil existe pour le jour
où la contention d'écriture deviendrait un problème.

```bash
docker compose --profile postgres up -d --build
```

Il faut alors ajouter au service `app`, dans `docker-compose.yml`, les variables
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` et `POSTGRES_HOST: postgres`,
puis `depends_on: [postgres]`. Les réglages Django basculent automatiquement sur PostgreSQL dès
que `POSTGRES_DB` est défini.

---

## Pannes courantes

| Symptôme | Cause | Solution |
|---|---|---|
| `port is already allocated` | 8000 déjà pris | `echo "PORT=9000" > .env` puis relancer |
| Le conteneur reste `starting` | premier import en cours | attendre 2-3 min, suivre `docker compose logs -f` |
| Page blanche, 404 sur les assets | build frontend incomplet | `docker compose build --no-cache` |
| `CSRF verification failed` sur l'admin | hôte absent de `DJANGO_CSRF_TRUSTED_ORIGINS` | ajouter l'origine complète avec son schéma |
| Catalogue vide | import échoué | `docker compose logs app \| grep -i erreur` |
| `permission denied` sur `/data` | bind mount au lieu du volume nommé | garder le volume nommé, ou `chown 999:999` le dossier hôte |
| Build lent à chaque fois | cache invalidé | ne pas modifier `package.json` inutilement ; la couche npm est cachée |

### Le message `→ lock incomplet pour npm ci, repli sur npm install`

Attendu, pas une erreur. Les dépendances WASM imbriquées de `@tailwindcss/oxide`
(`@emnapi/*`) ne sont jamais inscrites dans le `package-lock.json` généré sur une plateforme
qui dispose du binaire natif. `npm ci` les déclare donc manquantes et refuse de tourner. Le
Dockerfile tente `npm ci` d'abord et bascule sur `npm install` en le signalant.

---

## Sur un serveur, avec un vrai domaine

Ce guide couvre l'usage local. Pour une mise en ligne avec HTTPS, domaine et sauvegardes
automatiques, voir **[deploiement.md](deploiement.md)** — un VPS à environ 4 $/mois suffit.

L'image Docker convient aussi à un déploiement serveur : il suffit de placer Caddy ou Traefik
devant pour le TLS, et d'ajouter `DJANGO_BEHIND_PROXY=1` ainsi que le domaine dans
`DJANGO_ALLOWED_HOSTS` et `DJANGO_CSRF_TRUSTED_ORIGINS`.
