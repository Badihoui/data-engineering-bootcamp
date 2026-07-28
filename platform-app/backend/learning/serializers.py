from rest_framework import serializers

from catalog.serializers import ChoiceSerializer

from .models import Bookmark, Enrollment, FlashcardReview, LessonProgress, Note, QuizAttempt


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_slug = serializers.CharField(source="lesson.slug", read_only=True)
    module_slug = serializers.CharField(source="lesson.module.slug", read_only=True)

    class Meta:
        model = LessonProgress
        fields = [
            "id",
            "lesson",
            "lesson_slug",
            "module_slug",
            "status",
            "seconds_spent",
            "scroll_ratio",
            "started_at",
            "updated_at",
            "completed_at",
        ]
        read_only_fields = ["started_at", "updated_at", "completed_at"]


class QuizAttemptSerializer(serializers.ModelSerializer):
    module_slug = serializers.CharField(source="quiz.module.slug", read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            "id",
            "quiz",
            "module_slug",
            "score",
            "correct_count",
            "total_count",
            "passed",
            "answers",
            "created_at",
        ]
        read_only_fields = fields


class QuizSubmissionSerializer(serializers.Serializer):
    """Payload: {"answers": {"<question_id>": <choice_id>, ...}}"""

    answers = serializers.DictField(child=serializers.IntegerField())


class NoteSerializer(serializers.ModelSerializer):
    lesson_slug = serializers.CharField(source="lesson.slug", read_only=True)
    lesson_title = serializers.CharField(source="lesson.title", read_only=True)
    # The module is needed to build the link back — lesson slugs are only
    # unique within their module.
    module_slug = serializers.CharField(source="lesson.module.slug", read_only=True)
    module_title = serializers.CharField(source="lesson.module.title", read_only=True)

    class Meta:
        model = Note
        fields = [
            "id",
            "lesson",
            "lesson_slug",
            "lesson_title",
            "module_slug",
            "module_title",
            "body",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class BookmarkSerializer(serializers.ModelSerializer):
    module_slug = serializers.CharField(source="module.slug", read_only=True)
    module_title = serializers.CharField(source="module.title", read_only=True)

    class Meta:
        model = Bookmark
        fields = ["id", "module", "module_slug", "module_title", "created_at"]
        read_only_fields = ["created_at"]


class EnrollmentSerializer(serializers.ModelSerializer):
    track_slug = serializers.CharField(source="track.slug", read_only=True)

    class Meta:
        model = Enrollment
        fields = ["id", "track", "track_slug", "started_at", "completed_at"]
        read_only_fields = ["started_at", "completed_at"]


class FlashcardSerializer(serializers.ModelSerializer):
    """A card carries its question and, unlike a quiz, its answer.

    Self-assessment is the point of spaced repetition: the learner reveals the
    answer and rates their own recall, so there is nothing to hide.
    """

    prompt = serializers.CharField(source="question.prompt", read_only=True)
    kind = serializers.CharField(source="question.kind", read_only=True)
    explanation = serializers.CharField(source="question.explanation", read_only=True)
    module_slug = serializers.CharField(source="question.quiz.module.slug", read_only=True)
    module_title = serializers.CharField(source="question.quiz.module.title", read_only=True)
    choices = ChoiceSerializer(source="question.choices", many=True, read_only=True)
    correct_label = serializers.SerializerMethodField()
    is_new = serializers.SerializerMethodField()

    class Meta:
        model = FlashcardReview
        fields = [
            "id",
            "question",
            "prompt",
            "kind",
            "explanation",
            "choices",
            "correct_label",
            "module_slug",
            "module_title",
            "ease_factor",
            "interval_days",
            "repetitions",
            "lapses",
            "due_on",
            "last_grade",
            "is_new",
        ]
        read_only_fields = fields

    def get_correct_label(self, obj: FlashcardReview) -> str:
        choice = obj.question.choices.filter(is_correct=True).first()
        return choice.label if choice else ""

    def get_is_new(self, obj: FlashcardReview) -> bool:
        return obj.repetitions == 0 and obj.last_grade is None


class FlashcardGradeSerializer(serializers.Serializer):
    grade = serializers.ChoiceField(choices=[0, 3, 4, 5])
