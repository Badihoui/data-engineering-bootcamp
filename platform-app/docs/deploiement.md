# Guide de déploiement

Objectif : la plateforme en ligne, en HTTPS, sur un domaine à vous, pour **moins de 5 $ par
mois**, en une heure environ.

---

## 1. Le choix de l'hébergeur

### Ce dont l'application a réellement besoin

C'est ce qui détermine la facture, alors regardons-le honnêtement :

- **Le frontend est un bundle statique.** 119 kB gzip à l'entrée. N'importe quel serveur de
  fichiers le sert.
- **L'API est un Django modeste.** Deux workers gunicorn tiennent largement une promotion
  d'apprenants.
- **La base peut rester SQLite.** Le contenu est écrit une fois par l'import et lu ensuite ;
  les écritures se limitent à la progression, aux notes et aux révisions. Une base managée
  coûterait plus cher que le serveur lui-même pour aucun bénéfice à cette échelle.
- **Aucun calcul lourd côté serveur.** Le terminal, SQLite du playground et Pyodide tournent
  **dans le navigateur de l'apprenant**. C'est la particularité de cette plateforme : les
  ateliers ne coûtent rien en infrastructure.

Conclusion : un petit VPS suffit, et une plateforme facturant séparément le web et la base est
un mauvais calcul ici.

### Comparatif

| Offre | Prix / mois | Verdict |
|---|---|---|
| **Hetzner CAX11** (2 vCPU ARM, 4 Go, 40 Go) | **≈ 3,89 € ≈ 4,20 $** | ✅ **Recommandé** |
| Hetzner CX22 (2 vCPU x86, 4 Go, 40 Go) | ≈ 4,39 € ≈ 4,75 $ | ✅ si un binaire x86 vous manque |
| OVH VPS Starter (1 vCPU, 2 Go) | ≈ 4,20 € HT, ~5 € TTC | ✅ correct, moins de RAM |
| Scaleway Stardust (1 vCPU, 1 Go) | ≈ 2 € | ⚠️ 1 Go : le build frontend passe mal |
| DigitalOcean Basic (1 vCPU, 512 Mo) | 4 $ | ⚠️ 512 Mo : `npm run build` échoue |
| **Render** (Web Service + Postgres) | 7 $ + 7 $ = **14 $** | ❌ hors budget |
| **Railway** | ~5 $ mini, à l'usage | ⚠️ dépassements faciles |
| Fly.io (machine + volume) | ~3 $ | ⚠️ possible, mais gestion des volumes pénible |
| Vercel / Netlify | gratuit (frontend seul) | ❌ n'héberge pas Django |

**Recommandation : Hetzner CAX11.** 4 Go de RAM pour moins de 4 €, largement au-delà du
nécessaire, avec 20 To de trafic inclus. L'architecture ARM ne pose aucun problème : Python,
Node et SQLite y sont natifs.

> **Attention aux offres à 512 Mo–1 Go.** Le build Vite consomme environ 1 Go. Sur une machine
> trop petite, il faut construire le frontend en local et n'envoyer que `dist/` — c'est faisable
> (voir §8) mais cela complique chaque mise à jour.

### Budget total

| Poste | Coût |
|---|---|
| VPS Hetzner CAX11 | 3,29 € |
| Adresse IPv4 | 0,60 € |
| Domaine `.fr` ou `.dev` | ~10 €/an, soit 0,85 €/mois |
| Certificat TLS | 0 € (Let's Encrypt via Caddy) |
| Base de données | 0 € (SQLite) |
| **Total** | **≈ 4,75 € ≈ 5,10 $ / mois** |

Sans domaine dédié, on descend à **4,20 $**.

---

## 2. Commander et sécuriser le serveur

Chez Hetzner Cloud : nouveau projet → **Add Server** → Ubuntu 24.04 → type **CAX11** →
ajouter votre clé SSH → créer.

Première connexion, puis les gestes de base :

```bash
ssh root@VOTRE_IP

apt update && apt upgrade -y
apt install -y git curl rsync sqlite3 ufw fail2ban

# Pare-feu : SSH et web uniquement.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Un compte de service sans privilèges pour faire tourner l'application.
adduser --system --group --home /srv/bootcamp --shell /bin/bash bootcamp
mkdir -p /srv/bootcamp/{app,data,backups,frontend}
chown -R bootcamp:bootcamp /srv/bootcamp
```

Désactiver la connexion SSH par mot de passe si ce n'est pas déjà fait :

```bash
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

---

## 3. Le domaine

Chez votre registrar, créer un enregistrement **A** :

| Type | Nom | Valeur |
|---|---|---|
| A | `bootcamp` (ou `@`) | l'IPv4 du serveur |
| AAAA | `bootcamp` | l'IPv6 du serveur (optionnel) |

Vérifier la propagation avant d'aller plus loin — Caddy échouera à obtenir un certificat si le
domaine ne pointe pas encore :

```bash
dig +short bootcamp.exemple.fr
```

---

## 4. Installer les dépendances

```bash
# Python et outils de compilation
apt install -y python3 python3-venv python3-dev build-essential

# Node 22 (pour construire le frontend)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Caddy : serveur web avec HTTPS automatique
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

---

## 5. Déposer le code et la configuration

```bash
sudo -u bootcamp git clone https://github.com/VOTRE_COMPTE/data-engineering-bootcamp.git \
     /srv/bootcamp/app

cd /srv/bootcamp/app/platform-app

# Variables d'environnement
sudo -u bootcamp cp deploy/bootcamp.env.example /srv/bootcamp/bootcamp.env
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # → coller comme SECRET_KEY
sudo -u bootcamp nano /srv/bootcamp/bootcamp.env                # remplacer le domaine partout
chmod 600 /srv/bootcamp/bootcamp.env
chown bootcamp:bootcamp /srv/bootcamp/bootcamp.env
```

Le fichier doit contenir, au minimum :

```ini
DJANGO_SECRET_KEY=<64 caractères générés>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=bootcamp.exemple.fr
DJANGO_CSRF_TRUSTED_ORIGINS=https://bootcamp.exemple.fr
DJANGO_BEHIND_PROXY=1
SQLITE_PATH=/srv/bootcamp/data/db.sqlite3
CORS_ALLOWED_ORIGINS=https://bootcamp.exemple.fr
```

> `SQLITE_PATH` pointe **hors du dépôt**. C'est délibéré : le script de déploiement fait un
> `git reset --hard`, qui effacerait une base rangée dans l'arborescence Git.

---

## 6. Le service et le serveur web

```bash
cd /srv/bootcamp/app/platform-app

# Service systemd
cp deploy/bootcamp-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable bootcamp-api

# Caddy — remplacer le domaine dans le fichier avant de copier
sed -i 's/bootcamp\.exemple\.fr/bootcamp.exemple.fr/' deploy/Caddyfile   # ← votre domaine
cp deploy/Caddyfile /etc/caddy/Caddyfile
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl reload caddy
```

Autoriser le compte de service à redémarrer sa propre unité (le script de déploiement en a
besoin, et rien d'autre) :

```bash
cat > /etc/sudoers.d/bootcamp <<'EOF'
bootcamp ALL=(root) NOPASSWD: /bin/systemctl restart bootcamp-api
EOF
chmod 440 /etc/sudoers.d/bootcamp
```

---

## 7. Premier déploiement

```bash
chmod +x /srv/bootcamp/app/platform-app/deploy/*.sh
sudo -u bootcamp /srv/bootcamp/app/platform-app/deploy/deploy.sh
```

Le script installe les dépendances, migre, **importe les 36 notebooks**, construit le frontend,
le publie, redémarre l'API et lance les 40 vérifications de bout en bout. Comptez trois à cinq
minutes la première fois.

Créer ensuite le compte administrateur :

```bash
cd /srv/bootcamp/app/platform-app/backend
sudo -u bootcamp bash -c 'set -a; source /srv/bootcamp/bootcamp.env; set +a; \
  .venv/bin/python manage.py createsuperuser'
```

Rendez-vous sur `https://bootcamp.exemple.fr`. Le certificat est déjà en place.

### Sauvegardes

```bash
chmod +x /srv/bootcamp/app/platform-app/deploy/backup.sh
crontab -u bootcamp -e
# ajouter :
0 3 * * * /srv/bootcamp/app/platform-app/deploy/backup.sh
```

La sauvegarde passe par `sqlite3 .backup`, qui prend un instantané cohérent même pendant une
écriture — un simple `cp` produirait une base corrompue si une transaction est en cours.
Rapatrier les archives ailleurs de temps en temps :

```bash
rsync -avz bootcamp@VOTRE_IP:/srv/bootcamp/backups/ ./sauvegardes-bootcamp/
```

---

## 8. Mises à jour

Après chaque `git push` sur `main` :

```bash
ssh root@VOTRE_IP 'sudo -u bootcamp /srv/bootcamp/app/platform-app/deploy/deploy.sh'
```

### Variante pour serveur à faible mémoire

Si vous avez pris une machine à 1 Go, le build Vite ne passera pas. Construire en local et
n'envoyer que le résultat :

```bash
# Sur votre poste
cd platform-app/frontend && npm run build
rsync -avz --delete dist/ bootcamp@VOTRE_IP:/srv/bootcamp/frontend/

# Sur le serveur, la partie Python uniquement
ssh root@VOTRE_IP 'sudo -u bootcamp bash -c "
  cd /srv/bootcamp/app && git pull &&
  cd platform-app/backend &&
  set -a; source /srv/bootcamp/bootcamp.env; set +a &&
  .venv/bin/pip install -qr requirements.txt &&
  .venv/bin/python manage.py migrate --noinput &&
  .venv/bin/python manage.py import_content &&
  .venv/bin/python manage.py collectstatic --noinput" &&
  systemctl restart bootcamp-api'
```

---

## 9. Exploitation

```bash
# Journaux
journalctl -u bootcamp-api -f
tail -f /var/log/caddy/bootcamp.log

# État
systemctl status bootcamp-api caddy

# Vérification complète à tout moment
sudo -u bootcamp /srv/bootcamp/app/platform-app/backend/.venv/bin/python \
  /srv/bootcamp/app/platform-app/backend/scripts/smoke_test.py \
  --base https://bootcamp.exemple.fr/api --frontend https://bootcamp.exemple.fr

# Console Django
cd /srv/bootcamp/app/platform-app/backend
sudo -u bootcamp bash -c 'set -a; source /srv/bootcamp/bootcamp.env; set +a; \
  .venv/bin/python manage.py shell'
```

### Activer HSTS

Une fois le site stable en HTTPS depuis quelques jours, passer `DJANGO_HSTS_SECONDS=86400`
dans `bootcamp.env`, redémarrer, observer une semaine, puis monter à `31536000`.

> HSTS est difficile à annuler : les navigateurs mémorisent l'instruction. Ne l'activez que
> lorsque le domaine restera en HTTPS pour de bon.

---

## 10. Pannes courantes

| Symptôme | Cause | Solution |
|---|---|---|
| `CSRF verification failed` à la connexion admin | `DJANGO_CSRF_TRUSTED_ORIGINS` absent ou sans `https://` | corriger dans `bootcamp.env`, redémarrer |
| Page blanche, 404 sur les assets | `dist/` non publié | relancer `deploy.sh` |
| `502 Bad Gateway` | gunicorn arrêté | `journalctl -u bootcamp-api -n 50` |
| Certificat non délivré | DNS pas encore propagé | vérifier `dig`, puis `systemctl reload caddy` |
| `database is locked` | plusieurs écritures simultanées | déjà couvert par WAL + `busy_timeout` ; si cela persiste, c'est le signal de passer à PostgreSQL |
| `npm run build` tué (exit 137) | mémoire insuffisante | construire en local (§8) ou ajouter du swap |
| Catalogue vide | import non joué | `manage.py import_content` |

Ajouter du swap sur une petite machine :

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 11. Quand faudra-t-il changer d'échelle ?

L'architecture tient sans effort jusqu'à quelques centaines d'apprenants actifs, parce que les
ateliers s'exécutent chez eux. Les seuils réels :

- **`database is locked` récurrent** → passer à PostgreSQL. Les variables `POSTGRES_*` existent
  déjà dans les réglages : installer le serveur, les renseigner, migrer, réimporter.
- **Processeur saturé sur les requêtes API** → augmenter `--workers` dans l'unité systemd, puis
  changer de gabarit.
- **Bande passante** → mettre Cloudflare devant, gratuitement. Le frontend est entièrement
  cacheable.

Aucun de ces seuils ne se présentera avant longtemps.
