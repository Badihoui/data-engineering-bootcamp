"""Course catalog: Track → Module → Lesson → typed content blocks.

Lesson bodies are stored as an ordered list of typed blocks (JSON) rather than
raw markdown, so the React renderer can pick a dedicated component per block
type (prose, code, diagram, callout, exercise, table) instead of post-parsing
HTML on the client.
"""

from django.db import models


class Track(models.Model):
    """A level of the bootcamp: débutant, intermédiaire, avancé."""

    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=120)
    subtitle = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    color = models.CharField(max_length=20, default="#38bdf8")
    accent = models.CharField(max_length=20, default="#0ea5e9")
    icon = models.CharField(max_length=16, default="📘")
    objectives = models.JSONField(default=list, blank=True)
    outcomes = models.JSONField(default=list, blank=True)
    prerequisites = models.TextField(blank=True)
    estimated_weeks = models.PositiveIntegerField(default=10)

    class Meta:
        ordering = ["order"]

    def __str__(self) -> str:
        return self.title


class Module(models.Model):
    """One notebook of the bootcamp, turned into a structured course module."""

    KIND_COURSE = "course"
    KIND_PROJECT = "project"
    KIND_CHOICES = [(KIND_COURSE, "Cours"), (KIND_PROJECT, "Projet")]

    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="modules")
    slug = models.SlugField(unique=True, max_length=140)
    number = models.PositiveIntegerField(help_text="Numéro affiché (01..35), 0 pour les projets")
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=300, blank=True)
    summary = models.TextField(blank=True)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_COURSE)
    icon = models.CharField(max_length=16, default="📗")
    tags = models.JSONField(default=list, blank=True)
    objectives = models.JSONField(default=list, blank=True)
    prerequisites = models.JSONField(default=list, blank=True)
    estimated_minutes = models.PositiveIntegerField(default=60)
    difficulty = models.PositiveSmallIntegerField(default=1, help_text="1 à 5")
    notebook_path = models.CharField(max_length=255, blank=True)
    colab_url = models.URLField(blank=True)
    is_published = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "number"]

    def __str__(self) -> str:
        return f"{self.number:02d} — {self.title}"


class Lesson(models.Model):
    """A chapter inside a module — the unit a learner marks as completed."""

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    slug = models.SlugField(max_length=160)
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=250)
    summary = models.TextField(blank=True)
    blocks = models.JSONField(default=list, blank=True)
    estimated_minutes = models.PositiveIntegerField(default=8)
    xp_reward = models.PositiveIntegerField(default=20)
    has_code = models.BooleanField(default=False)
    has_diagram = models.BooleanField(default=False)
    has_exercise = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]
        unique_together = ("module", "slug")

    def __str__(self) -> str:
        return f"{self.module.number:02d}/{self.order:02d} — {self.title}"


class Diagram(models.Model):
    """A schema extracted from a notebook, rendered as a real image.

    `mermaid` holds a hand-authored or generated Mermaid source; `svg` an inline
    SVG. `source_ascii` keeps the original box-drawing block for traceability
    and is the fallback when neither has been authored yet.
    """

    FORMAT_MERMAID = "mermaid"
    FORMAT_SVG = "svg"
    FORMAT_TREE = "tree"
    FORMAT_STACK = "stack"
    FORMAT_PANELS = "panels"
    FORMAT_CALLOUT = "callout"
    FORMAT_ASCII = "ascii"
    FORMAT_CHOICES = [
        (FORMAT_MERMAID, "Mermaid (flux)"),
        (FORMAT_SVG, "SVG inline"),
        (FORMAT_TREE, "Arborescence"),
        (FORMAT_STACK, "Pile de couches"),
        (FORMAT_PANELS, "Panneaux comparatifs"),
        (FORMAT_CALLOUT, "Encadré titré"),
        (FORMAT_ASCII, "ASCII (à convertir)"),
    ]

    key = models.CharField(max_length=64, unique=True, help_text="Hash stable du bloc source")
    title = models.CharField(max_length=200, blank=True)
    caption = models.TextField(blank=True)
    module = models.ForeignKey(
        Module, on_delete=models.CASCADE, related_name="diagrams", null=True, blank=True
    )
    fmt = models.CharField(max_length=12, choices=FORMAT_CHOICES, default=FORMAT_ASCII)
    mermaid = models.TextField(blank=True)
    svg = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True, help_text="Structure pour tree/stack/panels")
    source_ascii = models.TextField(blank=True)

    class Meta:
        ordering = ["module__order", "key"]

    def __str__(self) -> str:
        return self.title or self.key

    @property
    def is_converted(self) -> bool:
        return self.fmt != self.FORMAT_ASCII


class Quiz(models.Model):
    """End-of-module knowledge check."""

    module = models.OneToOneField(Module, on_delete=models.CASCADE, related_name="quiz")
    title = models.CharField(max_length=200, default="Quiz de fin de module")
    description = models.TextField(blank=True)
    pass_score = models.PositiveSmallIntegerField(default=70, help_text="Score en %")
    xp_reward = models.PositiveIntegerField(default=100)

    def __str__(self) -> str:
        return f"Quiz — {self.module.title}"

    @property
    def question_count(self) -> int:
        return self.questions.count()


class Question(models.Model):
    """QCM noté côté serveur, ou question ouverte auto-évaluée (flashcard)."""

    KIND_MCQ = "mcq"
    KIND_OPEN = "open"
    KIND_CHOICES = [(KIND_MCQ, "QCM"), (KIND_OPEN, "Question ouverte")]

    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)
    kind = models.CharField(max_length=8, choices=KIND_CHOICES, default=KIND_MCQ)
    prompt = models.TextField()
    explanation = models.TextField(blank=True)

    class Meta:
        ordering = ["order"]

    def __str__(self) -> str:
        return self.prompt[:70]


class Choice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    order = models.PositiveIntegerField(default=0)
    label = models.CharField(max_length=8, blank=True, help_text="a, b, c, d")
    text = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]

    def __str__(self) -> str:
        return f"{self.label}) {self.text[:50]}"


class Resource(models.Model):
    """External link attached to a module (doc officielle, article, vidéo)."""

    module = models.ForeignKey(
        Module, on_delete=models.CASCADE, related_name="resources", null=True, blank=True
    )
    title = models.CharField(max_length=200)
    url = models.URLField()
    kind = models.CharField(max_length=40, default="doc")
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["title"]

    def __str__(self) -> str:
        return self.title
