"""The ASCII → figure converter is what keeps terminal art off the platform."""

from django.test import SimpleTestCase

from content.ascii_diagram import (
    analyse,
    diagram_key,
    extract_title,
    find_boxes,
    looks_like_diagram,
    parse_panels,
    parse_stack,
    parse_tree,
    to_mermaid,
)

PIPELINE = """
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Data Engineer  │ ──▶ │  Data Scientist │ ──▶ │  Data Analyst   │
│  Pipelines      │     │  Modélisation   │     │  Reporting      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
"""

VERTICAL = """
┌──────────────┐
│   SOURCES    │
└──────────────┘
        │
        ▼
┌──────────────┐
│  TRAITEMENT  │
└──────────────┘
"""

TREE = """
📁 mon_projet
    │
    ├── pipeline.py      ← versionné
    ├── config.yaml
    └── data/            ← à ignorer
"""

STACK = """
┌──────────────────────────────────────────┐
│            STACK DATA MODERNE            │
├──────────────────────────────────────────┤
│  Orchestration    │  Airflow / Dagster   │
│  Transformation   │  dbt / Spark         │
│  Stockage         │  S3 / Delta Lake     │
└──────────────────────────────────────────┘
"""

PANELS = """
   LAMBDA                        KAPPA
┌──────────────┐            ┌──────────────┐
│  Batch       │            │  Streaming   │
│  + Speed     │            │  uniquement  │
└──────────────┘            └──────────────┘
"""

NOT_A_DIAGRAM = "SELECT * FROM ventes WHERE pays = 'France';"


class DiagramKeyTests(SimpleTestCase):
    def test_key_is_stable_across_trailing_whitespace(self):
        self.assertEqual(diagram_key(PIPELINE), diagram_key(PIPELINE.replace("│\n", "│   \n")))

    def test_different_diagrams_get_different_keys(self):
        self.assertNotEqual(diagram_key(PIPELINE), diagram_key(TREE))

    def test_key_is_short_and_hexadecimal(self):
        key = diagram_key(PIPELINE)
        self.assertEqual(len(key), 16)
        self.assertRegex(key, r"^[0-9a-f]+$")


class DetectionTests(SimpleTestCase):
    def test_box_art_is_detected(self):
        self.assertTrue(looks_like_diagram(PIPELINE))
        self.assertTrue(looks_like_diagram(STACK))

    def test_plain_code_is_not_a_diagram(self):
        self.assertFalse(looks_like_diagram(NOT_A_DIAGRAM))
        self.assertFalse(looks_like_diagram(""))


class BoxTests(SimpleTestCase):
    def test_finds_every_rectangle(self):
        boxes = find_boxes(PIPELINE)
        self.assertEqual(len(boxes), 3)

    def test_reads_the_label_inside_a_box(self):
        first = find_boxes(PIPELINE)[0]
        self.assertIn("Data Engineer", first.label)
        self.assertIn("Pipelines", first.label)

    def test_keeps_the_inner_boxes_and_drops_the_wrapper(self):
        """A frame around other frames is decoration, not a node."""
        nested = """
┌────────────────────────────┐
│ ┌──────┐      ┌──────┐     │
│ │  A   │      │  B   │     │
│ └──────┘      └──────┘     │
└────────────────────────────┘
"""
        boxes = find_boxes(nested)
        self.assertEqual(len(boxes), 2)
        self.assertEqual([box.label for box in boxes], ["A", "B"])


class MermaidTests(SimpleTestCase):
    def test_horizontal_pipeline_becomes_a_left_to_right_flowchart(self):
        mermaid = to_mermaid(PIPELINE)
        self.assertIsNotNone(mermaid)
        self.assertTrue(mermaid.startswith("flowchart LR"))
        self.assertIn("n0 --> n1", mermaid)
        self.assertIn("n1 --> n2", mermaid)

    def test_vertical_pipeline_becomes_top_to_bottom(self):
        mermaid = to_mermaid(VERTICAL)
        self.assertIsNotNone(mermaid)
        self.assertTrue(mermaid.startswith("flowchart TB"))

    def test_labels_are_escaped_for_mermaid(self):
        mermaid = to_mermaid(PIPELINE)
        for forbidden in ('"Data', "[", "]"):
            self.assertNotIn(f'["{forbidden}', mermaid.replace('["Data Engineer', ""))

    def test_disconnected_boxes_yield_no_flowchart(self):
        self.assertIsNone(to_mermaid(PANELS))

    def test_single_box_yields_no_flowchart(self):
        self.assertIsNone(to_mermaid(STACK))


class TreeTests(SimpleTestCase):
    def test_parses_root_and_children(self):
        data = parse_tree(TREE)
        self.assertIsNotNone(data)
        self.assertEqual(data["root"], "📁 mon_projet")
        labels = [node["label"] for node in data["nodes"]]
        self.assertEqual(labels, ["pipeline.py", "config.yaml", "data/"])

    def test_captures_trailing_annotations(self):
        data = parse_tree(TREE)
        self.assertEqual(data["nodes"][0]["note"], "versionné")
        self.assertEqual(data["nodes"][1]["note"], "")

    def test_nests_by_indentation(self):
        nested = """
main
  ├── develop
  │     ├── feature/a
  │     └── feature/b
  └── hotfix
"""
        data = parse_tree(nested)
        self.assertEqual(len(data["nodes"]), 2)
        self.assertEqual(len(data["nodes"][0]["children"]), 2)

    def test_boxed_schema_is_not_a_tree(self):
        self.assertIsNone(parse_tree(PIPELINE))
        self.assertIsNone(parse_tree(STACK))


class StackTests(SimpleTestCase):
    def test_reads_title_and_rows(self):
        data = parse_stack(STACK)
        self.assertIsNotNone(data)
        self.assertEqual(data["title"], "STACK DATA MODERNE")
        self.assertEqual(len(data["rows"]), 3)
        self.assertEqual(data["rows"][0]["label"], "Orchestration")
        self.assertIn("Airflow", data["rows"][0]["detail"])

    def test_multi_box_schema_is_not_a_stack(self):
        self.assertIsNone(parse_stack(PIPELINE))


class PanelTests(SimpleTestCase):
    def test_side_by_side_frames_become_panels(self):
        data = parse_panels(PANELS)
        self.assertIsNotNone(data)
        self.assertEqual(len(data["panels"]), 2)
        self.assertEqual(data["panels"][0]["title"], "Batch")

    def test_captures_the_caption_above_each_frame(self):
        data = parse_panels(PANELS)
        captions = [panel.get("caption", "") for panel in data["panels"]]
        self.assertIn("LAMBDA", " ".join(captions))


class AnalyseTests(SimpleTestCase):
    def test_picks_the_best_format_for_each_shape(self):
        self.assertEqual(analyse(PIPELINE)["fmt"], "mermaid")
        self.assertEqual(analyse(TREE)["fmt"], "tree")
        self.assertEqual(analyse(STACK)["fmt"], "stack")
        self.assertEqual(analyse(PANELS)["fmt"], "panels")

    def test_mermaid_result_carries_its_source(self):
        result = analyse(PIPELINE)
        self.assertTrue(result["mermaid"].startswith("flowchart"))
        self.assertEqual(result["data"], {})

    def test_structured_result_carries_its_data(self):
        result = analyse(TREE)
        self.assertEqual(result["mermaid"], "")
        self.assertEqual(result["data"]["kind"], "tree")

    def test_unrecognised_layout_falls_back_to_ascii(self):
        timeline = """
2010 ──────── 2015 ──────── 2020 ──────── 2026
 │             │             │             │
Hadoop       Spark        Lakehouse     Data Mesh
"""
        self.assertEqual(analyse(timeline)["fmt"], "ascii")


class TitleTests(SimpleTestCase):
    def test_uses_the_first_prose_line_as_caption(self):
        self.assertEqual(extract_title(PANELS), "LAMBDA                        KAPPA")

    def test_returns_empty_when_the_block_is_only_drawing(self):
        self.assertEqual(extract_title(PIPELINE), "")
