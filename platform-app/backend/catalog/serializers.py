from rest_framework import serializers

from .models import Choice, Diagram, Lesson, Module, Question, Quiz, Resource, Track


class DiagramSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagram
        fields = ["key", "title", "caption", "fmt", "mermaid", "svg", "data", "source_ascii"]


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = ["title", "url", "kind", "description"]


class ChoiceSerializer(serializers.ModelSerializer):
    """Never exposes `is_correct` — grading happens server-side."""

    class Meta:
        model = Choice
        fields = ["id", "label", "text"]


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    explanation = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ["id", "order", "kind", "prompt", "choices", "explanation"]

    def get_explanation(self, obj: Question) -> str:
        """Open questions are self-assessed, so their answer ships with them.
        MCQ explanations stay hidden until the attempt is graded."""
        return obj.explanation if obj.kind == Question.KIND_OPEN else ""


class QuizSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    question_count = serializers.IntegerField(read_only=True)
    graded_count = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = [
            "id",
            "title",
            "description",
            "pass_score",
            "xp_reward",
            "question_count",
            "graded_count",
            "questions",
        ]

    def get_graded_count(self, obj: Quiz) -> int:
        return obj.questions.filter(kind=Question.KIND_MCQ).count()


class LessonListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = [
            "id",
            "slug",
            "order",
            "title",
            "summary",
            "estimated_minutes",
            "xp_reward",
            "has_code",
            "has_diagram",
            "has_exercise",
        ]


class LessonDetailSerializer(serializers.ModelSerializer):
    module_slug = serializers.CharField(source="module.slug", read_only=True)
    module_title = serializers.CharField(source="module.title", read_only=True)
    module_number = serializers.IntegerField(source="module.number", read_only=True)
    track_slug = serializers.CharField(source="module.track.slug", read_only=True)
    diagrams = serializers.SerializerMethodField()
    neighbours = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id",
            "slug",
            "order",
            "title",
            "summary",
            "blocks",
            "estimated_minutes",
            "xp_reward",
            "has_code",
            "has_diagram",
            "has_exercise",
            "module_slug",
            "module_title",
            "module_number",
            "track_slug",
            "diagrams",
            "neighbours",
        ]

    def get_diagrams(self, obj: Lesson) -> dict:
        keys = [b.get("key") for b in obj.blocks if b.get("type") == "diagram" and b.get("key")]
        if not keys:
            return {}
        qs = Diagram.objects.filter(key__in=keys)
        return {d.key: DiagramSerializer(d).data for d in qs}

    def get_neighbours(self, obj: Lesson) -> dict:
        siblings = list(obj.module.lessons.order_by("order").values("slug", "title", "order"))
        idx = next((i for i, s in enumerate(siblings) if s["slug"] == obj.slug), None)
        if idx is None:
            return {"previous": None, "next": None}
        return {
            "previous": siblings[idx - 1] if idx > 0 else None,
            "next": siblings[idx + 1] if idx + 1 < len(siblings) else None,
        }


class ModuleListSerializer(serializers.ModelSerializer):
    track_slug = serializers.CharField(source="track.slug", read_only=True)
    track_title = serializers.CharField(source="track.title", read_only=True)
    track_color = serializers.CharField(source="track.color", read_only=True)
    lesson_count = serializers.IntegerField(read_only=True)
    has_quiz = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = [
            "id",
            "slug",
            "number",
            "order",
            "title",
            "subtitle",
            "summary",
            "kind",
            "icon",
            "tags",
            "estimated_minutes",
            "difficulty",
            "colab_url",
            "notebook_path",
            "lesson_count",
            "has_quiz",
            "track_slug",
            "track_title",
            "track_color",
        ]

    def get_has_quiz(self, obj: Module) -> bool:
        return hasattr(obj, "quiz")


class ModuleDetailSerializer(ModuleListSerializer):
    lessons = LessonListSerializer(many=True, read_only=True)
    resources = ResourceSerializer(many=True, read_only=True)
    quiz = QuizSerializer(read_only=True)

    class Meta(ModuleListSerializer.Meta):
        fields = ModuleListSerializer.Meta.fields + [
            "objectives",
            "prerequisites",
            "lessons",
            "resources",
            "quiz",
        ]


class TrackSerializer(serializers.ModelSerializer):
    module_count = serializers.IntegerField(read_only=True)
    total_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Track
        fields = [
            "id",
            "slug",
            "title",
            "subtitle",
            "description",
            "order",
            "color",
            "accent",
            "icon",
            "objectives",
            "outcomes",
            "prerequisites",
            "estimated_weeks",
            "module_count",
            "total_minutes",
        ]


class TrackDetailSerializer(TrackSerializer):
    modules = ModuleListSerializer(many=True, read_only=True)

    class Meta(TrackSerializer.Meta):
        fields = TrackSerializer.Meta.fields + ["modules"]
