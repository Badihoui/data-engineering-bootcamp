"""Inspect and scaffold the diagram registry.

    python manage.py diagram_report                  # coverage summary
    python manage.py diagram_report --pending        # list schemas still in ASCII
    python manage.py diagram_report --scaffold       # write stub .mmd files to author
"""

from pathlib import Path

from django.core.management.base import BaseCommand

from catalog.models import Diagram

REGISTRY = Path(__file__).resolve().parents[2] / "diagrams"


class Command(BaseCommand):
    help = "État de la conversion des schémas ASCII en images."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--pending", action="store_true", help="Lister les schémas non convertis")
        parser.add_argument(
            "--scaffold",
            action="store_true",
            help="Créer un fichier .mmd de départ pour chaque schéma non converti",
        )
        parser.add_argument("--module", help="Filtrer sur un slug de module")

    def handle(self, *args, **options) -> None:
        qs = Diagram.objects.select_related("module")
        if options["module"]:
            qs = qs.filter(module__slug=options["module"])

        total = qs.count()
        converted = qs.exclude(fmt=Diagram.FORMAT_ASCII).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"{converted}/{total} schémas rendus en image "
                f"({round(converted * 100 / total) if total else 0} %)"
            )
        )

        pending = qs.filter(fmt=Diagram.FORMAT_ASCII)
        by_module: dict[str, int] = {}
        for diagram in pending:
            label = diagram.module.title if diagram.module else "—"
            by_module[label] = by_module.get(label, 0) + 1
        if by_module:
            self.stdout.write("\nÀ convertir par module :")
            for label, count in sorted(by_module.items(), key=lambda kv: -kv[1]):
                self.stdout.write(f"  {count:3d}  {label}")

        if options["pending"]:
            self.stdout.write("\nClés en attente :")
            for diagram in pending:
                title = diagram.title or diagram.source_ascii.strip().splitlines()[0][:60]
                self.stdout.write(f"  {diagram.key}  {title}")

        if options["scaffold"]:
            REGISTRY.mkdir(parents=True, exist_ok=True)
            written = 0
            for diagram in pending:
                target = REGISTRY / f"{diagram.key}.mmd"
                if target.exists():
                    continue
                ascii_comment = "\n".join(
                    f"%%   {line}" for line in diagram.source_ascii.strip().splitlines()[:40]
                )
                target.write_text(
                    f"%% title: {diagram.title or 'À nommer'}\n"
                    f"%% caption:\n"
                    f"%% Source ASCII d'origine :\n{ascii_comment}\n\n"
                    "flowchart LR\n"
                    '    a["À compléter"] --> b["À compléter"]\n',
                    encoding="utf-8",
                )
                written += 1
            self.stdout.write(self.style.SUCCESS(f"\n{written} fichiers créés dans {REGISTRY}"))
