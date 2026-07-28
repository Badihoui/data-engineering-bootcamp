"""Parse a bootcamp notebook into the platform's course structure.

A notebook becomes a Module. Its top-level `##` headings become Lessons, and
every markdown/code fragment becomes a typed block that the React renderer maps
to a dedicated component:

    markdown | code | diagram | callout | exercise | solution | table

Quiz sections (`## Quiz…` with `### ❓ Qn.` questions) are pulled out of the
lesson flow and returned separately so they can be graded server-side.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .ascii_diagram import analyse, diagram_key, extract_title, looks_like_diagram

FENCE_RE = re.compile(r"```([a-zA-Z0-9_+-]*)\n(.*?)```", re.DOTALL)
DETAILS_RE = re.compile(
    r"<details>\s*(?:<summary>(?P<summary>.*?)</summary>)?(?P<body>.*?)</details>",
    re.DOTALL | re.IGNORECASE,
)
H2_RE = re.compile(r"^##\s+(?!#)(.*)$", re.MULTILINE)
QUESTION_RE = re.compile(
    r"^(?:###+\s*(?:❓\s*)?|\*\*)Q(?P<num>\d+)[.)]?\*{0,2}\s*(?P<prompt>.+?)\s*$",
    re.MULTILINE,
)
OPTION_RE = re.compile(r"^\s*([a-eA-E])\)\s+(.*?)\s*$", re.MULTILINE)
# Two answer conventions coexist in the notebooks:
#   "✅ **Réponse : c** — …"   and   "✅ **b** — …"
ANSWER_RE = re.compile(r"Réponse\s*:?\s*\**\s*([a-eA-E])\b", re.IGNORECASE)
ANSWER_SHORT_RE = re.compile(r"✅\s*\**\s*([a-eA-E])\b")
LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)\s]+)\)")

QUIZ_HEADING_HINTS = ("quiz", "questions de validation", "auto-évaluation")
RESOURCE_HEADING_HINTS = ("ressources", "pour aller plus loin", "liens utiles")
EXERCISE_HINTS = ("exercice", "exercise", "à toi de jouer", "challenge", "tp ")

# Rough reading speed used to estimate lesson duration.
CHARS_PER_MINUTE = 900
CODE_SECONDS_PER_LINE = 4


@dataclass
class ParsedQuestion:
    prompt: str
    options: list[tuple[str, str]]
    answer: str
    explanation: str = ""

    @property
    def is_mcq(self) -> bool:
        return bool(self.options) and bool(self.answer)


@dataclass
class ParsedLesson:
    title: str
    blocks: list[dict] = field(default_factory=list)
    summary: str = ""

    @property
    def has_code(self) -> bool:
        return any(b["type"] == "code" for b in self.blocks)

    @property
    def has_diagram(self) -> bool:
        return any(b["type"] == "diagram" for b in self.blocks)

    @property
    def has_exercise(self) -> bool:
        return any(b["type"] in ("exercise", "solution") for b in self.blocks)

    @property
    def estimated_minutes(self) -> int:
        chars = sum(len(b.get("md", "")) for b in self.blocks)
        code_lines = sum(len(b.get("code", "").splitlines()) for b in self.blocks)
        minutes = chars / CHARS_PER_MINUTE + code_lines * CODE_SECONDS_PER_LINE / 60
        return max(2, round(minutes))


@dataclass
class ParsedNotebook:
    title: str
    summary: str
    objectives: list[str]
    prerequisites: list[str]
    lessons: list[ParsedLesson]
    questions: list[ParsedQuestion]
    diagrams: list[dict]
    resources: list[dict]


def _clean(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text.strip())


def _make_diagram_block(raw: str, collected: list[dict]) -> dict:
    key = diagram_key(raw)
    title = extract_title(raw)
    rendering = analyse(raw)
    collected.append({"key": key, "title": title, "source_ascii": raw, **rendering})
    return {"type": "diagram", "key": key, "title": title}


def _split_markdown(md: str, diagrams: list[dict]) -> list[dict]:
    """Split a markdown cell into prose / code / diagram / solution blocks.

    `<details>` is handled *before* fenced code, because solutions almost always
    wrap a code block — splitting on fences first would tear the opening and
    closing tags apart and lose the collapsible.
    """
    blocks: list[dict] = []
    cursor = 0
    for match in DETAILS_RE.finditer(md):
        blocks.extend(_split_fences(md[cursor : match.start()], diagrams))
        summary = re.sub(r"<[^>]+>", "", match.group("summary") or "Solution").strip()
        body = _clean(match.group("body") or "")
        blocks.append(
            {
                "type": "solution",
                "summary": summary or "Solution",
                "children": _split_markdown(body, diagrams) if body else [],
            }
        )
        cursor = match.end()
    blocks.extend(_split_fences(md[cursor:], diagrams))
    return blocks


def _split_fences(text: str, diagrams: list[dict]) -> list[dict]:
    """Split prose on fenced blocks, routing box art to the diagram pipeline."""
    blocks: list[dict] = []

    def flush_prose(chunk: str) -> None:
        cleaned = _clean(chunk)
        if cleaned:
            blocks.append({"type": "markdown", "md": cleaned})

    cursor = 0
    for match in FENCE_RE.finditer(text):
        flush_prose(text[cursor : match.start()])
        lang = (match.group(1) or "").lower()
        body = match.group(2)
        if looks_like_diagram(body) and lang in ("", "text", "txt", "plain"):
            blocks.append(_make_diagram_block(body, diagrams))
        else:
            blocks.append({"type": "code", "lang": lang or "text", "code": body.rstrip()})
        cursor = match.end()
    flush_prose(text[cursor:])
    return blocks


def _parse_questions(section: str) -> list[ParsedQuestion]:
    """Read `### ❓ Qn.` blocks with a), b), c) options and a <details> answer."""
    questions: list[ParsedQuestion] = []
    matches = list(QUESTION_RE.finditer(section))
    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(section)
        body = section[start:end]

        details = DETAILS_RE.search(body)
        answer_zone = details.group("body") if details else body
        option_zone = body[: details.start()] if details else body

        options = [(letter.lower(), txt.strip()) for letter, txt in OPTION_RE.findall(option_zone)]
        answer_match = ANSWER_RE.search(answer_zone) or ANSWER_SHORT_RE.search(answer_zone)

        explanation = re.sub(r"<[^>]+>", "", answer_zone)
        explanation = re.sub(r"\s+", " ", explanation).strip()
        # Strip the answer marker, but only when one is really there: a bare
        # `[a-e]` would otherwise eat the first letter of an open answer
        # ("Event Time = …" → "vent Time = …").
        explanation = re.sub(
            r"^✅\s*\**\s*(?:Réponse\s*:?\s*\**\s*)?[a-eA-E]\**\s*[—\-–:]+\s*", "", explanation
        )
        explanation = re.sub(
            r"^\**\s*Réponse\s*:?\s*\**\s*[a-eA-E]\**\s*[—\-–:]*\s*", "", explanation
        )
        if not explanation and not options:
            continue

        # Open questions (no a/b/c options) become self-assessed flashcards.
        questions.append(
            ParsedQuestion(
                prompt=_clean(match.group("prompt")).strip("*"),
                options=options if answer_match else [],
                answer=answer_match.group(1).lower() if answer_match else "",
                explanation=explanation[:600],
            )
        )
    return questions


def _parse_resources(section: str) -> list[dict]:
    """Collect the markdown links of a `## Ressources` section."""
    seen: set[str] = set()
    resources: list[dict] = []
    for title, url in LINK_RE.findall(section):
        if url in seen:
            continue
        seen.add(url)
        kind = "video" if "youtube" in url or "vimeo" in url else "doc"
        resources.append({"title": re.sub(r"[*`]", "", title)[:200], "url": url, "kind": kind})
    return resources


def _cell_source(cell: dict) -> str:
    source = cell.get("source", "")
    return source if isinstance(source, str) else "".join(source)


def _is_quiz_heading(title: str) -> bool:
    low = title.lower()
    return any(hint in low for hint in QUIZ_HEADING_HINTS)


def _extract_meta(intro_md: str) -> tuple[str, str, list[str], list[str]]:
    """Title, summary, objectives and prerequisites from the first cell."""
    title_match = re.search(r"^#\s+(?!#)(.*)$", intro_md, re.MULTILINE)
    title = _clean(title_match.group(1)) if title_match else ""

    body = intro_md[title_match.end() :] if title_match else intro_md
    body = FENCE_RE.sub("", body)
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    summary = ""
    for para in paragraphs:
        if para.startswith(("#", "|", "-", "*", ">")):
            continue
        summary = re.sub(r"\s+", " ", re.sub(r"[*_`]", "", para))
        break

    objectives = _bullets_after(body, ("objectif", "objectives", "tu vas", "vous allez", "au programme"))
    prerequisites = _bullets_after(body, ("prérequis", "prerequis", "prerequisites"))
    return title, summary[:400], objectives, prerequisites


def _bullets_after(text: str, hints: tuple[str, ...]) -> list[str]:
    lines = text.splitlines()
    collected: list[str] = []
    capturing = False
    for line in lines:
        low = line.lower()
        if any(hint in low for hint in hints) and (line.startswith("#") or line.startswith("**") or line.endswith(":")):
            capturing = True
            continue
        if capturing:
            stripped = line.strip()
            if stripped.startswith(("- ", "* ", "✅", "•")):
                collected.append(re.sub(r"^[-*✅•]\s*", "", stripped).strip(" *_`"))
            elif stripped.startswith("|") and "|" in stripped[1:]:
                cells = [c.strip() for c in stripped.strip("|").split("|")]
                if len(cells) >= 2 and not set(cells[0]) <= set("-: "):
                    collected.append(" — ".join(c for c in cells if c)[:160])
            elif stripped and not stripped.startswith(">"):
                capturing = False
        if len(collected) >= 8:
            break
    return [c for c in collected if c][:8]


def parse_notebook(path: Path) -> ParsedNotebook:
    notebook = json.loads(path.read_text(encoding="utf-8"))
    cells = notebook.get("cells", [])

    diagrams: list[dict] = []
    questions: list[ParsedQuestion] = []
    lessons: list[ParsedLesson] = []
    resources: list[dict] = []

    intro_md = next((_cell_source(c) for c in cells if c["cell_type"] == "markdown"), "")
    title, summary, objectives, prerequisites = _extract_meta(intro_md)

    current = ParsedLesson(title="Introduction")
    consumed_intro = False

    for cell in cells:
        source = _cell_source(cell)
        if cell["cell_type"] == "code":
            code = source.rstrip()
            if code:
                current.blocks.append({"type": "code", "lang": "python", "code": code})
            continue

        if not consumed_intro and source is intro_md:
            consumed_intro = True

        # A markdown cell may open one or several `##` sections.
        headings = list(H2_RE.finditer(source))
        if not headings:
            current.blocks.extend(_split_markdown(source, diagrams))
            continue

        lead = source[: headings[0].start()]
        if lead.strip():
            current.blocks.extend(_split_markdown(lead, diagrams))

        for idx, heading in enumerate(headings):
            end = headings[idx + 1].start() if idx + 1 < len(headings) else len(source)
            section_title = _clean(heading.group(1)).strip("# ")
            section_body = source[heading.end() : end]

            if _is_quiz_heading(section_title):
                questions.extend(_parse_questions(section_body))
                continue

            low_title = section_title.lower()
            if any(hint in low_title for hint in RESOURCE_HEADING_HINTS):
                resources.extend(_parse_resources(section_body))
                continue

            if current.blocks:
                lessons.append(current)
            current = ParsedLesson(title=section_title)
            current.blocks.extend(_split_markdown(section_body, diagrams))

    if current.blocks:
        lessons.append(current)

    for lesson in lessons:
        first_prose = next(
            (b["md"] for b in lesson.blocks if b["type"] == "markdown" and len(b["md"]) > 60), ""
        )
        lesson.summary = re.sub(r"[*_`#>|]", "", re.sub(r"\s+", " ", first_prose))[:220].strip()
        if any(hint in lesson.title.lower() for hint in EXERCISE_HINTS):
            for block in lesson.blocks:
                if block["type"] == "code":
                    block["type"] = "exercise"
                    break

    return ParsedNotebook(
        title=title or path.stem,
        summary=summary,
        objectives=objectives,
        prerequisites=prerequisites,
        lessons=lessons,
        questions=questions,
        diagrams=diagrams,
        resources=resources,
    )
