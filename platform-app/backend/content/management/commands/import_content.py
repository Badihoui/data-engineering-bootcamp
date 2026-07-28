"""Import the bootcamp notebooks into the platform database.

    python manage.py import_content            # full import
    python manage.py import_content --only 24  # a single module

Idempotent: running it again updates modules in place and replaces their
lessons, so the notebooks stay the single source of truth for the content.
"""

from __future__ import annotations

import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from accounts.models import Badge
from catalog.models import Choice, Diagram, Lesson, Module, Question, Quiz, Resource, Track
from content import curriculum_meta as meta
from content.notebook_parser import parse_notebook

DIAGRAM_REGISTRY = Path(__file__).resolve().parents[2] / "diagrams"


class Command(BaseCommand):
    help = "Importe les notebooks du bootcamp dans le catalogue de la plateforme."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--only", help="Filtre sur un numéro ou un nom de notebook")
        parser.add_argument(
            "--notebooks-dir",
            default=str(settings.REPO_ROOT / "notebooks"),
            help="Répertoire racine des notebooks",
        )

    def handle(self, *args, **options) -> None:
        root = Path(options["notebooks_dir"])
        if not root.exists():
            self.stderr.write(self.style.ERROR(f"Répertoire introuvable : {root}"))
            return

        self._sync_tracks()
        self._sync_badges()

        files = sorted(root.glob("*/*.ipynb"))
        if options["only"]:
            needle = options["only"]
            files = [f for f in files if needle in f.name]

        imported = 0
        for path in files:
            folder = path.parent.name
            track_slug = meta.TRACK_BY_FOLDER.get(folder)
            if not track_slug:
                self.stdout.write(f"  ↷ ignoré (dossier inconnu) : {path}")
                continue
            self._import_notebook(path, Track.objects.get(slug=track_slug))
            imported += 1

        self._report_diagrams()
        self.stdout.write(self.style.SUCCESS(f"\n✅ {imported} modules importés."))

    # ------------------------------------------------------------------ tracks

    def _sync_tracks(self) -> None:
        for payload in meta.TRACKS:
            Track.objects.update_or_create(slug=payload["slug"], defaults=payload)
        self.stdout.write(f"Parcours synchronisés : {Track.objects.count()}")

    def _sync_badges(self) -> None:
        for payload in meta.BADGES:
            Badge.objects.update_or_create(slug=payload["slug"], defaults=payload)
        self.stdout.write(f"Badges synchronisés : {Badge.objects.count()}")

    # ------------------------------------------------------------------ import

    @transaction.atomic
    def _import_notebook(self, path: Path, track: Track) -> None:
        parsed = parse_notebook(path)
        filename = path.name
        icon, difficulty, tags = meta.MODULE_META.get(filename, ("📗", 2, []))
        number_match = re.match(r"(\d+)", filename)
        number = int(number_match.group(1)) if number_match else 0
        is_project = filename in meta.PROJECT_FILES
        title = meta.TITLE_OVERRIDES.get(filename, parsed.title)
        rel_path = str(path.relative_to(settings.REPO_ROOT))

        # Projects sit at the end of their track.
        order = number if number else 99

        module, _ = Module.objects.update_or_create(
            slug=slugify(f"{number:02d}-{title}")[:140] if number else slugify(title)[:140],
            defaults={
                "track": track,
                "number": number,
                "order": order,
                "title": title,
                "subtitle": parsed.summary[:300],
                "summary": parsed.summary,
                "kind": Module.KIND_PROJECT if is_project else Module.KIND_COURSE,
                "icon": icon,
                "tags": tags,
                "objectives": parsed.objectives,
                "prerequisites": parsed.prerequisites,
                "difficulty": difficulty,
                "notebook_path": rel_path,
                "colab_url": meta.colab_url(rel_path),
            },
        )

        self._sync_diagrams(module, parsed.diagrams)

        module.lessons.all().delete()
        used_slugs: set[str] = set()
        total_minutes = 0
        for index, lesson in enumerate(parsed.lessons, start=1):
            slug = slugify(lesson.title)[:140] or f"section-{index}"
            if slug in used_slugs:
                slug = f"{slug}-{index}"[:150]
            used_slugs.add(slug)
            minutes = lesson.estimated_minutes
            total_minutes += minutes
            Lesson.objects.create(
                module=module,
                slug=slug,
                order=index,
                title=lesson.title[:250],
                summary=lesson.summary,
                blocks=lesson.blocks,
                estimated_minutes=minutes,
                xp_reward=10 + minutes,
                has_code=lesson.has_code,
                has_diagram=lesson.has_diagram,
                has_exercise=lesson.has_exercise,
            )

        module.estimated_minutes = max(10, total_minutes)
        module.save(update_fields=["estimated_minutes"])

        self._sync_quiz(module, parsed.questions)
        self._sync_resources(module, parsed.resources)

        flag = "📦" if is_project else "  "
        self.stdout.write(
            f"{flag} {filename:52s} → {len(parsed.lessons):2d} leçons, "
            f"{len(parsed.questions):2d} questions, {len(parsed.diagrams):3d} schémas, "
            f"{total_minutes:3d} min"
        )

    def _sync_quiz(self, module: Module, questions: list) -> None:
        Quiz.objects.filter(module=module).delete()
        if not questions:
            return
        quiz = Quiz.objects.create(
            module=module,
            title=f"Quiz — {module.title}"[:200],
            description="Valide tes acquis avant de passer au module suivant.",
        )
        for order, parsed_question in enumerate(questions, start=1):
            question = Question.objects.create(
                quiz=quiz,
                order=order,
                kind=Question.KIND_MCQ if parsed_question.is_mcq else Question.KIND_OPEN,
                prompt=parsed_question.prompt,
                explanation=parsed_question.explanation,
            )
            if not parsed_question.is_mcq:
                continue
            for choice_order, (letter, text) in enumerate(parsed_question.options, start=1):
                Choice.objects.create(
                    question=question,
                    order=choice_order,
                    label=letter,
                    text=text,
                    is_correct=letter == parsed_question.answer,
                )

    def _sync_resources(self, module: Module, resources: list[dict]) -> None:
        module.resources.all().delete()
        for payload in resources:
            Resource.objects.create(module=module, **payload)

    # ---------------------------------------------------------------- diagrams

    def _sync_diagrams(self, module: Module, diagrams: list[dict]) -> None:
        """Persist diagrams, giving priority to hand-authored registry files."""
        for payload in diagrams:
            key = payload["key"]
            authored = self._read_registry(key)
            defaults = {
                "module": module,
                "title": (authored or {}).get("title") or payload["title"],
                "caption": (authored or {}).get("caption", ""),
                "source_ascii": payload["source_ascii"],
            }
            if authored and authored.get("mermaid"):
                defaults |= {
                    "fmt": Diagram.FORMAT_MERMAID,
                    "mermaid": authored["mermaid"],
                    "svg": "",
                    "data": {},
                }
            elif authored and authored.get("svg"):
                defaults |= {
                    "fmt": Diagram.FORMAT_SVG,
                    "svg": authored["svg"],
                    "mermaid": "",
                    "data": {},
                }
            else:
                defaults |= {
                    "fmt": payload["fmt"],
                    "mermaid": payload.get("mermaid", ""),
                    "data": payload.get("data", {}),
                }
            Diagram.objects.update_or_create(key=key, defaults=defaults)

    @staticmethod
    def _read_registry(key: str) -> dict | None:
        """Read `diagrams/<key>.mmd` or `<key>.svg`, with `%% title:` metadata."""
        mmd = DIAGRAM_REGISTRY / f"{key}.mmd"
        if mmd.exists():
            lines = mmd.read_text(encoding="utf-8").splitlines()
            title = caption = ""
            body: list[str] = []
            for line in lines:
                if line.startswith("%% title:"):
                    title = line.split(":", 1)[1].strip()
                elif line.startswith("%% caption:"):
                    caption = line.split(":", 1)[1].strip()
                else:
                    body.append(line)
            return {"mermaid": "\n".join(body).strip(), "title": title, "caption": caption}
        svg = DIAGRAM_REGISTRY / f"{key}.svg"
        if svg.exists():
            return {"svg": svg.read_text(encoding="utf-8"), "title": "", "caption": ""}
        return None

    def _report_diagrams(self) -> None:
        total = Diagram.objects.count()
        converted = Diagram.objects.exclude(fmt=Diagram.FORMAT_ASCII).count()
        pending = total - converted
        pct = round(converted * 100 / total) if total else 0
        self.stdout.write(
            f"\n🖼️  Schémas : {converted}/{total} rendus en image ({pct} %), {pending} en attente."
        )
        if pending:
            self.stdout.write(
                "   → `python manage.py diagram_report --pending` pour la liste à convertir."
            )
