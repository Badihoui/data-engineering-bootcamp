"""Turn the box-drawing ASCII schemas of the notebooks into real diagrams.

The notebooks contain 300+ diagrams drawn with Unicode box characters inside
fenced blocks. They render as terminal art, which is exactly what we do not
want on the platform. This module detects the rectangles and the arrows between
them and emits a Mermaid `flowchart`, which the frontend renders as a clean SVG.

Only well-formed layouts are converted automatically; anything else is reported
as pending so it can be authored by hand in `content/diagrams/<key>.mmd`.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

BOX_CHARS = "┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬▶◀▲▼"
HORIZONTAL = "─═-"
ARROW_RIGHT = "▶>→"
ARROW_DOWN = "▼v"
VERTICAL = "│║|"


def diagram_key(text: str) -> str:
    """Stable identifier for a diagram, derived from its normalised source."""
    normalised = "\n".join(line.rstrip() for line in text.strip().splitlines())
    return hashlib.sha1(normalised.encode("utf-8")).hexdigest()[:16]


def looks_like_diagram(text: str) -> bool:
    """True when a fenced block is box art rather than code."""
    if not text.strip():
        return False
    hits = sum(text.count(ch) for ch in "┌┐└┘├┤┬┴┼╔╗╚╝")
    return hits >= 4


@dataclass
class Box:
    top: int
    left: int
    bottom: int
    right: int
    lines: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        return " ".join(part.strip() for part in self.lines if part.strip())

    @property
    def center_row(self) -> int:
        return (self.top + self.bottom) // 2


def _grid(text: str) -> list[str]:
    lines = text.strip("\n").splitlines()
    width = max((len(line) for line in lines), default=0)
    return [line.ljust(width) for line in lines]


RIGHT_BORDER_CHARS = VERTICAL + "┤╣┐┘╗╝"


def _right_border(line: str, expected: int, tolerance: int = 2) -> int | None:
    """Column of a row's right border.

    The strict column wins. Drift is only tolerated when the row is genuinely
    ragged — its content stops before the expected column, which is what
    accented characters and emoji do to a hand-drawn frame. Allowing drift
    everywhere would let adjacent or nested frames match each other's borders.
    """
    if 0 <= expected < len(line) and line[expected] in RIGHT_BORDER_CHARS:
        return expected

    content_end = len(line.rstrip())
    if content_end == 0 or content_end > expected:
        return None
    for col in range(max(0, expected - tolerance), content_end):
        if line[col] in RIGHT_BORDER_CHARS and col >= expected - tolerance:
            return col
    return None


def find_boxes(text: str) -> list[Box]:
    """Detect axis-aligned rectangles drawn with ┌ ┐ └ ┘ (or the double variant)."""
    grid = _grid(text)
    corners_tl = "┌╔"
    corners_tr = "┐╗"
    corners_bl = "└╚"
    corners_br = "┘╝"
    boxes: list[Box] = []

    for row, line in enumerate(grid):
        for col, char in enumerate(line):
            if char not in corners_tl:
                continue
            # Find the top-right corner on the same row.
            right = None
            for c in range(col + 1, len(line)):
                ch = line[c]
                if ch in corners_tr:
                    right = c
                    break
                if ch not in HORIZONTAL and ch not in "┬╦":
                    break
            if right is None:
                continue
            # Find the bottom edge sharing both columns. The right border is
            # matched with a small tolerance: accented characters and emoji make
            # the source lines ragged, so a frame drawn as a perfect rectangle
            # ends up one or two columns off on some rows.
            bottom = None
            for r in range(row + 1, len(grid)):
                left_ch = grid[r][col] if col < len(grid[r]) else " "
                right_col = _right_border(grid[r], right)
                right_ch = grid[r][right_col] if right_col is not None else " "
                if left_ch in corners_bl and right_ch in corners_br:
                    bottom = r
                    break
                if left_ch not in VERTICAL + "├╠" or right_ch not in VERTICAL + "┤╣":
                    break
            if bottom is None:
                continue
            inner = [
                grid[r][col + 1 : right].strip(BOX_CHARS + " ") for r in range(row + 1, bottom)
            ]
            boxes.append(Box(top=row, left=col, bottom=bottom, right=right, lines=inner))

    # Keep the leaves. When a frame wraps other frames it is decoration — a
    # title border or a legend — while the boxes inside it are the actual
    # nodes of the schema. Keeping the wrapper instead would flatten a whole
    # pipeline into one opaque rectangle.
    leaves: list[Box] = []
    for box in boxes:
        wraps_another = any(
            other is not box
            and box.top <= other.top
            and box.left <= other.left
            and box.bottom >= other.bottom
            and box.right >= other.right
            for other in boxes
        )
        if not wraps_another:
            leaves.append(box)
    return leaves


def _horizontal_link(grid: list[str], a: Box, b: Box) -> bool:
    """True when a run of ─/▶ connects the right edge of `a` to the left of `b`."""
    if b.left <= a.right:
        return False
    rows = range(max(a.top, b.top), min(a.bottom, b.bottom) + 1)
    for row in rows:
        if row >= len(grid):
            continue
        gap = grid[row][a.right + 1 : b.left]
        if not gap.strip():
            continue
        if all(ch in HORIZONTAL + ARROW_RIGHT + " " for ch in gap) and any(
            ch in HORIZONTAL + ARROW_RIGHT for ch in gap
        ):
            return True
    return False


def _vertical_link(grid: list[str], a: Box, b: Box) -> bool:
    if b.top <= a.bottom:
        return False
    cols = range(max(a.left, b.left), min(a.right, b.right) + 1)
    for col in cols:
        gap = "".join(
            grid[r][col] if col < len(grid[r]) else " " for r in range(a.bottom + 1, b.top)
        )
        if not gap.strip():
            continue
        if all(ch in VERTICAL + ARROW_DOWN + " " for ch in gap) and any(
            ch in VERTICAL + ARROW_DOWN for ch in gap
        ):
            return True
    return False


_LABEL_CLEAN = re.compile(r"[\"`\[\]{}()<>|]")


def _mermaid_label(text: str) -> str:
    label = _LABEL_CLEAN.sub("", text).strip()
    label = re.sub(r"\s+", " ", label)
    return label[:70] or "…"


def to_mermaid(text: str) -> str | None:
    """Best-effort ASCII → Mermaid conversion. Returns None when unsupported."""
    boxes = find_boxes(text)
    if len(boxes) < 2 or len(boxes) > 14:
        return None

    grid = _grid(text)
    boxes = sorted(boxes, key=lambda b: (b.top, b.left))
    edges: list[tuple[int, int]] = []
    for i, a in enumerate(boxes):
        for j, b in enumerate(boxes):
            if i == j:
                continue
            if _horizontal_link(grid, a, b) or _vertical_link(grid, a, b):
                edges.append((i, j))

    if not edges:
        return None

    # Prefer left-to-right when the layout is mostly horizontal.
    horizontal = sum(1 for i, j in edges if boxes[j].left > boxes[i].right)
    direction = "LR" if horizontal >= len(edges) / 2 else "TB"

    lines = [f"flowchart {direction}"]
    for idx, box in enumerate(boxes):
        lines.append(f'    n{idx}["{_mermaid_label(box.label)}"]')
    seen = set()
    for i, j in edges:
        if (i, j) in seen:
            continue
        seen.add((i, j))
        lines.append(f"    n{i} --> n{j}")
    return "\n".join(lines)


TREE_CONNECTOR_RE = re.compile(r"^(?P<indent>[\s│|]*)(?P<connector>├──|└──|├─|└─|`--|\|--)\s*(?P<label>.*)$")


def _is_tree_label(match: re.Match | None) -> bool:
    """A tree node carries real text, not more box drawing."""
    if match is None:
        return False
    label = match.group("label")
    meaningful = [ch for ch in label if ch not in BOX_CHARS and not ch.isspace()]
    return len(meaningful) >= 2


def parse_tree(text: str) -> dict | None:
    """Detect a file/folder tree (`├──`, `└──`) and return a nested structure."""
    # A real frame means this is a boxed schema, not an indentation tree.
    if find_boxes(text):
        return None
    lines = [line.rstrip() for line in text.strip("\n").splitlines() if line.strip()]
    connectors = [
        line
        for line in lines
        if TREE_CONNECTOR_RE.match(line) and _is_tree_label(TREE_CONNECTOR_RE.match(line))
    ]
    if len(connectors) < 2:
        return None

    root_label = ""
    nodes: list[dict] = []
    stack: list[tuple[int, dict]] = []
    for line in lines:
        match = TREE_CONNECTOR_RE.match(line)
        if not _is_tree_label(match):
            if not nodes and not root_label and "│" not in line:
                root_label = line.strip()
            continue
        depth = len(match.group("indent"))
        raw = match.group("label").strip()
        if not raw:
            continue
        # Trailing "← comment" annotations become the node's note.
        note = ""
        for marker in ("←", "<-", "#"):
            if marker in raw:
                raw, _, note = raw.partition(marker)
                note = note.strip()
                break
        node = {"label": raw.strip(), "note": note, "children": []}
        while stack and stack[-1][0] >= depth:
            stack.pop()
        if stack:
            stack[-1][1]["children"].append(node)
        else:
            nodes.append(node)
        stack.append((depth, node))

    if not nodes:
        return None
    return {"kind": "tree", "root": root_label, "nodes": nodes}


def parse_stack(text: str) -> dict | None:
    """A single frame holding stacked rows (`│ label │ value │`) → a layer stack."""
    boxes = find_boxes(text)
    if len(boxes) != 1:
        return None
    box = boxes[0]
    grid = _grid(text)
    rows: list[dict] = []
    title = ""
    for row_index in range(box.top + 1, box.bottom):
        raw = grid[row_index][box.left : box.right + 1]
        if set(raw.strip()) <= set("├┤─┼╠╣═╬ "):
            continue
        inner = raw.strip("│║ ")
        cells = [c.strip() for c in re.split(r"[│║]", inner) if c.strip()]
        if not cells:
            continue
        if len(cells) == 1 and not rows and not title:
            title = cells[0]
            continue
        rows.append({"label": cells[0], "detail": " · ".join(cells[1:])})
    if len(rows) < 2:
        return None
    return {"kind": "stack", "title": title, "rows": rows}


def parse_panels(text: str) -> dict | None:
    """Several disconnected frames → side-by-side comparison cards."""
    boxes = find_boxes(text)
    if len(boxes) < 2 or len(boxes) > 8:
        return None
    grid = _grid(text)
    panels = []
    for box in boxes:
        lines = [line for line in box.lines if line and set(line) - set("─═ ")]
        if not lines:
            continue
        panels.append({"title": lines[0], "lines": lines[1:]})
    if len(panels) < 2:
        return None
    # Above each frame there is often a bare caption line.
    captions = []
    for box in boxes:
        above = grid[box.top - 1][box.left : box.right + 1].strip() if box.top > 0 else ""
        captions.append(above if above and not set(above) & set("┌┐└┘│─") else "")
    for panel, caption in zip(panels, captions):
        if caption:
            panel["caption"] = caption
    return {"kind": "panels", "panels": panels}


def parse_callout(text: str) -> dict | None:
    """A single frame holding a title and prose — a boxed aside, not a flow.

    Very common in the advanced modules ("RÈGLES DE SIZING", "QUAND UTILISER
    QUOI ?"): the frame is pure decoration around structured text, so it should
    render as a titled card rather than as terminal art.
    """
    boxes = find_boxes(text)
    if len(boxes) != 1:
        return None
    box = boxes[0]
    grid = _grid(text)

    # Any row split into two cells means this is a layered stack, not prose.
    for row_index in range(box.top + 1, box.bottom):
        inner = grid[row_index][box.left + 1 : box.right].strip("│║ ")
        if len([c for c in re.split(r"[│║]", inner) if c.strip()]) > 1:
            return None

    title = ""
    body: list[dict] = []
    for row_index in range(box.top + 1, box.bottom):
        raw = grid[row_index][box.left + 1 : box.right]
        stripped = raw.strip("│║ ")
        if not stripped or set(stripped) <= set("─═ ┼"):
            continue
        # A separator row closes the heading area.
        if set(grid[row_index][box.left : box.right + 1].strip()) <= set("├┤─═╠╣ "):
            continue
        if not title:
            title = stripped
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        marker = stripped[0]
        if marker in "•-*▪◦":
            body.append({"kind": "bullet", "text": stripped[1:].strip(), "indent": indent})
        elif set(stripped) <= set("─═_"):
            continue
        elif stripped.endswith(":") or stripped.isupper():
            body.append({"kind": "heading", "text": stripped, "indent": indent})
        else:
            body.append({"kind": "text", "text": stripped, "indent": indent})

    if len(body) < 2:
        return None
    return {"kind": "callout", "title": title, "body": body}


def analyse(text: str) -> dict:
    """Pick the best rendering for a box-art block.

    Returns {"fmt": ..., "mermaid": str, "data": dict} where fmt is one of
    mermaid / tree / stack / panels / callout / ascii.
    """
    mermaid = to_mermaid(text)
    if mermaid:
        return {"fmt": "mermaid", "mermaid": mermaid, "data": {}}
    for parser, fmt in (
        (parse_tree, "tree"),
        (parse_callout, "callout"),
        (parse_stack, "stack"),
        (parse_panels, "panels"),
    ):
        data = parser(text)
        if data:
            return {"fmt": fmt, "mermaid": "", "data": data}
    return {"fmt": "ascii", "mermaid": "", "data": {}}


def extract_title(text: str) -> str:
    """Heuristic caption: the first non-box line above/inside the drawing."""
    for line in text.strip().splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if any(ch in stripped for ch in "┌└├│─┐┘┤"):
            continue
        cleaned = stripped.strip("═ #*").strip()
        if len(cleaned) > 3:
            return cleaned[:120]
    return ""
