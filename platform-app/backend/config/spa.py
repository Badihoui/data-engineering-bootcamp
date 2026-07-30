"""Service du frontend React depuis Django, pour l'image Docker.

En développement, Vite sert la SPA et relaie `/api`. En conteneur, on ne veut
qu'un seul processus : Django sert donc aussi le bundle construit. WhiteNoise
prend en charge les fichiers hachés de `assets/`, et cette vue assure le repli
sur `index.html` pour les routes côté client — sans quoi un rechargement de
`/app/revision` renverrait un 404.
"""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse
from django.views.generic import View

# Chemins réservés à l'API : jamais interceptés par le repli SPA.
API_PREFIXES = ("api/", "admin/", "static/", "media/")


class SpaView(View):
    """Renvoie `index.html` pour toute route non-API."""

    def get(self, request: HttpRequest, path: str = "") -> HttpResponse:
        if path.startswith(API_PREFIXES):
            raise Http404(path)

        index = Path(settings.SPA_ROOT) / "index.html"
        if not index.is_file():
            raise Http404(
                "Frontend absent : lancer `npm run build` puis copier `dist/` "
                f"dans {settings.SPA_ROOT}."
            )

        response = HttpResponse(index.read_bytes(), content_type="text/html")
        # index.html ne doit jamais venir d'un cache périmé : il référence des
        # assets hachés qui n'existent plus après un nouveau déploiement.
        response["Cache-Control"] = "no-cache, must-revalidate"
        return response
