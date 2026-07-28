#!/usr/bin/env python
"""Vérification de bout en bout contre les serveurs en marche.

    python scripts/smoke_test.py [--base http://127.0.0.1:8000/api]

Complète la suite Django : celle-ci teste la logique, celui-ci teste que
l'application déployée répond réellement — routes câblées, migrations
appliquées, contenu importé, permissions en place.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

# Compte de vérification. Les valeurs par défaut ne valent que pour un
# environnement de développement ; en production, exporter SMOKE_EMAIL et
# SMOKE_PASSWORD plutôt que de créer ce compte-là sur le serveur.
DEMO = {
    "email": os.environ.get("SMOKE_EMAIL", "demo@bootcamp.dev"),
    "password": os.environ.get("SMOKE_PASSWORD", "changeme-en-developpement"),
}


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def check(self, label: str, condition: bool, detail: str = "") -> bool:
        mark = "✅" if condition else "❌"
        suffix = f" — {detail}" if detail and not condition else ""
        print(f"{mark} {label}{suffix}")
        if not condition:
            self.failures.append(label)
        return condition

    def note(self, text: str) -> None:
        print(f"   {text}")


def call(base: str, method: str, path: str, token: str | None = None, body: dict | None = None):
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method, f"{base}{path}"]
    cmd += ["-H", "Content-Type: application/json"]
    if token:
        cmd += ["-H", f"Authorization: Bearer {token}"]
    if body is not None:
        cmd += ["-d", json.dumps(body)]
    out = subprocess.check_output(cmd, text=True)
    payload, _, code = out.rpartition("\n")
    try:
        return int(code), (json.loads(payload) if payload else None)
    except json.JSONDecodeError:
        return int(code), payload[:200]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8000/api")
    parser.add_argument("--frontend", default="http://127.0.0.1:5173")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    report = Report()

    def get(path: str, token: str | None = None):
        return call(base, "GET", path, token)

    # ------------------------------------------------------------ auth
    print("\n— Authentification")
    code, data = call(base, "POST", "/auth/login/", body=DEMO)
    report.check("connexion JWT", code == 200 and isinstance(data, dict) and "access" in data, str(data)[:120])
    token = data.get("access") if isinstance(data, dict) else None
    if not token:
        print("\n❌ Impossible de continuer sans jeton.")
        return 1

    code, me = get("/auth/me/", token)
    report.check("profil courant", code == 200 and "email" in me)

    # -------------------------------------------------------- catalogue
    print("\n— Catalogue")
    code, stats = get("/stats/")
    report.check("statistiques", code == 200 and stats["modules"] > 0, str(stats)[:120])
    report.note(
        f"{stats['modules']} modules · {stats['projects']} projets · {stats['lessons']} leçons · "
        f"{stats['quizzes']} quiz"
    )
    ratio = stats["diagrams_converted"] / stats["diagrams"]
    report.check(
        "au moins 85 % des schémas rendus en image",
        ratio >= 0.85,
        f"{stats['diagrams_converted']}/{stats['diagrams']} = {ratio:.0%}",
    )

    code, tracks = get("/tracks/")
    report.check("trois parcours", code == 200 and tracks["count"] == 3)

    code, modules = get("/modules/")
    report.check("liste des modules", code == 200 and len(modules) >= 30, f"{len(modules)}")

    slug = modules[0]["slug"]
    code, module = get(f"/modules/{slug}/")
    report.check("détail d'un module", code == 200 and bool(module["lessons"]), slug)
    report.check(
        "la clé de correction ne fuite jamais",
        "is_correct" not in json.dumps(module.get("quiz") or {}),
    )

    # ----------------------------------------------------------- leçons
    print("\n— Leçons et schémas")
    lesson_slug = module["lessons"][min(3, len(module["lessons"]) - 1)]["slug"]
    code, lesson = get(f"/lessons/{lesson_slug}/?module={slug}")
    report.check("détail d'une leçon", code == 200 and bool(lesson["blocks"]), lesson_slug)
    report.check("blocs typés", all("type" in block for block in lesson["blocks"]))
    report.check("navigation entre leçons", lesson["neighbours"]["next"] is not None)

    code, diagrams = get("/diagrams/")
    kinds: dict[str, int] = {}
    for diagram in diagrams:
        kinds[diagram["fmt"]] = kinds.get(diagram["fmt"], 0) + 1
    report.note("formats : " + " · ".join(f"{k} {v}" for k, v in sorted(kinds.items())))
    for fmt in ("mermaid", "tree", "stack", "panels", "callout"):
        report.check(f"format « {fmt} » produit", kinds.get(fmt, 0) > 0)
    report.check(
        "chaque schéma mermaid porte une source",
        all(d["mermaid"] for d in diagrams if d["fmt"] == "mermaid"),
    )

    # --------------------------------------------------------- recherche
    print("\n— Recherche")
    code, results = get("/search/?q=kafka")
    report.check(
        "recherche globale",
        code == 200 and (results["modules"] or results["lessons"]),
        str(results)[:120],
    )
    report.note(f"{len(results['modules'])} modules · {len(results['lessons'])} leçons")
    code, short = get("/search/?q=k")
    report.check("requête trop courte ignorée", short["modules"] == [] and short["lessons"] == [])

    # ---------------------------------------------------- espace apprenant
    print("\n— Espace apprenant")
    for label, path in [
        ("tableau de bord", "/me/dashboard/"),
        ("progression", "/me/progress/"),
        ("session de révision", "/me/flashcards/"),
        ("statistiques de révision", "/me/flashcards/stats/"),
        ("certificats", "/me/certificates/"),
        ("notes", "/notes/"),
        ("favoris", "/bookmarks/"),
        ("tentatives de quiz", "/me/quiz-attempts/"),
    ]:
        code, payload = get(path, token)
        report.check(label, code == 200, f"HTTP {code}")

    code, board = get("/leaderboard/")
    report.check("classement public", code == 200 and "entries" in board)

    # ---------------------------------------------------------- sécurité
    print("\n— Sécurité")
    for label, path in [
        ("tableau de bord", "/me/dashboard/"),
        ("progression", "/me/progress/"),
        ("révision", "/me/flashcards/"),
        ("certificats", "/me/certificates/"),
    ]:
        code, _ = get(path)
        report.check(f"{label} refusé sans jeton", code == 401, f"HTTP {code}")

    code, _ = call(base, "POST", f"/modules/{slug}/quiz/submit/", body={"answers": {}})
    report.check("soumission de quiz refusée sans jeton", code == 401, f"HTTP {code}")

    # ---------------------------------------------------------- frontend
    print("\n— Frontend")
    served = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", args.frontend],
        capture_output=True,
        text=True,
    ).stdout
    report.check("serveur de développement", served == "200", f"HTTP {served}")
    proxied = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{args.frontend}/api/stats/"],
        capture_output=True,
        text=True,
    ).stdout
    report.check("proxy /api vers Django", proxied == "200", f"HTTP {proxied}")
    wasm = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", f"{args.frontend}/sql-wasm.wasm"],
        capture_output=True,
        text=True,
    ).stdout
    report.check("binaire SQLite servi", wasm == "200", f"HTTP {wasm}")

    print()
    if report.failures:
        print(f"❌ {len(report.failures)} vérification(s) en échec :")
        for failure in report.failures:
            print(f"   · {failure}")
        return 1
    print("✅ Toutes les vérifications passent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
