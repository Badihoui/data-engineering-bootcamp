"""The importer turns notebooks into course content — its parsing must not drift."""

import json
import tempfile
from pathlib import Path

from django.test import SimpleTestCase

from content.notebook_parser import parse_notebook


def notebook(*cells: dict) -> Path:
    """Writes a throwaway .ipynb and returns its path."""
    payload = {"cells": list(cells), "metadata": {}, "nbformat": 4, "nbformat_minor": 5}
    handle = tempfile.NamedTemporaryFile("w", suffix=".ipynb", delete=False, encoding="utf-8")
    json.dump(payload, handle)
    handle.close()
    return Path(handle.name)


def md(source: str) -> dict:
    return {"cell_type": "markdown", "source": source, "metadata": {}}


def code(source: str) -> dict:
    return {"cell_type": "code", "source": source, "metadata": {}, "outputs": [], "execution_count": None}


INTRO = """# Kafka & Streaming

Ce module couvre le traitement de flux en temps réel avec Apache Kafka.

## Prérequis

- Module 19 : PySpark avancé
- Module 23 : formats de table

**Objectifs :**

- Comprendre les topics et partitions
- Écrire un producer et un consumer
"""


class MetadataTests(SimpleTestCase):
    def test_reads_title_and_summary_from_the_first_cell(self):
        parsed = parse_notebook(notebook(md(INTRO)))
        self.assertEqual(parsed.title, "Kafka & Streaming")
        self.assertIn("traitement de flux", parsed.summary)

    def test_collects_objectives_and_prerequisites(self):
        parsed = parse_notebook(notebook(md(INTRO)))
        self.assertIn("Comprendre les topics et partitions", parsed.objectives)
        self.assertTrue(any("PySpark" in item for item in parsed.prerequisites))

    def test_falls_back_to_the_filename_when_there_is_no_heading(self):
        path = notebook(md("Pas de titre ici."))
        self.assertEqual(parse_notebook(path).title, path.stem)


class LessonSplittingTests(SimpleTestCase):
    def test_each_h2_becomes_a_lesson(self):
        parsed = parse_notebook(
            notebook(md(INTRO), md("## 1. Les topics\n\nUn topic est un journal."), md("## 2. Les partitions\n\nElles parallélisent."))
        )
        titles = [lesson.title for lesson in parsed.lessons]
        self.assertIn("1. Les topics", titles)
        self.assertIn("2. Les partitions", titles)

    def test_several_sections_in_one_cell_are_split(self):
        parsed = parse_notebook(
            notebook(md("## A\n\nTexte A.\n\n## B\n\nTexte B.\n\n## C\n\nTexte C."))
        )
        self.assertEqual([lesson.title for lesson in parsed.lessons], ["A", "B", "C"])

    def test_code_cells_land_in_the_current_lesson(self):
        parsed = parse_notebook(
            notebook(md("## Producer\n\nÉcrivons un producer."), code("from kafka import KafkaProducer"))
        )
        lesson = parsed.lessons[-1]
        self.assertTrue(lesson.has_code)
        self.assertEqual(lesson.blocks[-1]["type"], "code")
        self.assertEqual(lesson.blocks[-1]["lang"], "python")

    def test_duration_grows_with_content(self):
        short = parse_notebook(notebook(md("## Court\n\nUne phrase.")))
        long = parse_notebook(notebook(md("## Long\n\n" + "Une phrase longue. " * 400)))
        self.assertGreater(long.lessons[0].estimated_minutes, short.lessons[0].estimated_minutes)
        self.assertGreaterEqual(short.lessons[0].estimated_minutes, 2)


class BlockTests(SimpleTestCase):
    def test_fenced_code_becomes_a_code_block(self):
        parsed = parse_notebook(
            notebook(md("## Config\n\nVoici la config :\n\n```yaml\nbroker: kafka:9092\n```\n"))
        )
        blocks = parsed.lessons[0].blocks
        self.assertEqual([b["type"] for b in blocks], ["markdown", "code"])
        self.assertEqual(blocks[1]["lang"], "yaml")
        self.assertIn("broker", blocks[1]["code"])

    def test_box_art_becomes_a_diagram_block(self):
        drawing = "## Flux\n\n```\n┌──────┐   ┌──────┐\n│  A   │──▶│  B   │\n└──────┘   └──────┘\n```\n"
        parsed = parse_notebook(notebook(md(drawing)))
        types = [b["type"] for b in parsed.lessons[0].blocks]
        self.assertIn("diagram", types)
        self.assertEqual(len(parsed.diagrams), 1)
        self.assertTrue(parsed.lessons[0].has_diagram)

    def test_details_becomes_a_collapsible_solution(self):
        source = (
            "## Exercice 1\n\nCrée un topic.\n\n"
            "<details><summary>💡 Solution</summary>\n\n```bash\nkafka-topics --create\n```\n\n</details>\n"
        )
        parsed = parse_notebook(notebook(md(source)))
        solution = next(b for b in parsed.lessons[0].blocks if b["type"] == "solution")
        self.assertEqual(solution["summary"], "💡 Solution")
        self.assertEqual(solution["children"][0]["type"], "code")

    def test_exercise_sections_flag_their_lesson(self):
        parsed = parse_notebook(
            notebook(md("## Exercice 2 : produire des messages\n\nÀ toi."), code("# TODO"))
        )
        self.assertTrue(parsed.lessons[-1].has_exercise)


class QuizTests(SimpleTestCase):
    MCQ = """## Quiz

### ❓ Q1. Que stocke un topic Kafka ?
a) Des tables
b) Un journal de messages
c) Des index

<details><summary>💡 Réponse</summary>

✅ **Réponse : b** — Un topic est un journal distribué append-only.

</details>

### ❓ Q2. À quoi sert une partition ?
a) À chiffrer
b) À paralléliser la consommation

<details><summary>💡 Réponse</summary>

✅ **b** — Les partitions permettent le parallélisme.

</details>
"""

    OPEN = """## Quiz

**Q1.** Différence entre Event Time et Processing Time ?
<details><summary>R</summary>Event Time = quand l'événement s'est produit.</details>

**Q2.** Rôle du watermark ?
<details><summary>R</summary>Définir la tolérance au retard.</details>
"""

    def test_extracts_mcq_questions_with_their_answer(self):
        parsed = parse_notebook(notebook(md(self.MCQ)))
        self.assertEqual(len(parsed.questions), 2)
        first = parsed.questions[0]
        self.assertEqual(first.prompt, "Que stocke un topic Kafka ?")
        self.assertEqual(first.answer, "b")
        self.assertTrue(first.is_mcq)
        self.assertEqual(len(first.options), 3)

    def test_supports_both_answer_conventions(self):
        parsed = parse_notebook(notebook(md(self.MCQ)))
        self.assertEqual(parsed.questions[1].answer, "b")

    def test_explanation_drops_the_answer_prefix(self):
        parsed = parse_notebook(notebook(md(self.MCQ)))
        explanation = parsed.questions[0].explanation
        self.assertTrue(explanation.startswith("Un topic est un journal"))

    def test_open_questions_have_no_options(self):
        parsed = parse_notebook(notebook(md(self.OPEN)))
        self.assertEqual(len(parsed.questions), 2)
        self.assertFalse(parsed.questions[0].is_mcq)
        self.assertIn("Event Time", parsed.questions[0].explanation)

    def test_quiz_section_is_not_turned_into_a_lesson(self):
        parsed = parse_notebook(notebook(md(INTRO), md(self.MCQ)))
        self.assertNotIn("Quiz", [lesson.title for lesson in parsed.lessons])


class ResourceTests(SimpleTestCase):
    def test_collects_links_from_the_resources_section(self):
        source = (
            "## 📚 Ressources\n\n"
            "- [Kafka Documentation](https://kafka.apache.org/documentation/)\n"
            "- [Debezium](https://debezium.io/documentation/)\n"
        )
        parsed = parse_notebook(notebook(md(source)))
        urls = [resource["url"] for resource in parsed.resources]
        self.assertIn("https://kafka.apache.org/documentation/", urls)
        self.assertEqual(len(parsed.resources), 2)

    def test_deduplicates_repeated_links(self):
        source = "## Ressources\n\n- [A](https://x.dev)\n- [A bis](https://x.dev)\n"
        parsed = parse_notebook(notebook(md(source)))
        self.assertEqual(len(parsed.resources), 1)

    def test_resources_section_is_not_a_lesson(self):
        parsed = parse_notebook(notebook(md("## Ressources\n\n- [A](https://x.dev)\n")))
        self.assertEqual(parsed.lessons, [])


class RealNotebookTests(SimpleTestCase):
    """Smoke test against the actual bootcamp content."""

    def test_parses_the_introduction_module(self):
        from django.conf import settings

        path = settings.REPO_ROOT / "notebooks" / "beginner" / "01_intro_data_engineering.ipynb"
        if not path.exists():
            self.skipTest("notebooks absents")
        parsed = parse_notebook(path)
        self.assertEqual(parsed.title, "Introduction au Data Engineering")
        self.assertGreaterEqual(len(parsed.lessons), 5)
        self.assertGreaterEqual(len(parsed.questions), 5)
        self.assertTrue(all(question.is_mcq for question in parsed.questions))
