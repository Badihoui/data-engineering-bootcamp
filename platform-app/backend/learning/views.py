from django.contrib.auth import get_user_model
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.serializers import BadgeSerializer
from catalog.models import Lesson, Question, Quiz, Track

from .models import Bookmark, Enrollment, FlashcardReview, LessonProgress, Note, QuizAttempt
from .serializers import (
    BookmarkSerializer,
    FlashcardGradeSerializer,
    FlashcardSerializer,
    EnrollmentSerializer,
    LessonProgressSerializer,
    NoteSerializer,
    QuizAttemptSerializer,
    QuizSubmissionSerializer,
)
from .services import (
    dashboard_payload,
    evaluate_badges,
    flashcard_stats,
    module_progress_map,
)


class OwnedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NoteViewSet(OwnedModelViewSet):
    queryset = Note.objects.select_related("lesson", "lesson__module")
    serializer_class = NoteSerializer
    filterset_fields = ["lesson__slug"]


class BookmarkViewSet(OwnedModelViewSet):
    queryset = Bookmark.objects.select_related("module")
    serializer_class = BookmarkSerializer


class EnrollmentViewSet(OwnedModelViewSet):
    queryset = Enrollment.objects.select_related("track")
    serializer_class = EnrollmentSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_progress(request):
    """Full progress snapshot: per-lesson statuses + per-module rollups."""
    progress = LessonProgress.objects.filter(user=request.user).select_related(
        "lesson", "lesson__module"
    )
    return Response(
        {
            "lessons": LessonProgressSerializer(progress, many=True).data,
            "modules": module_progress_map(request.user),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def track_lesson(request, slug: str):
    """Upsert progress for a lesson.

    Body: {"status": "in_progress"|"completed", "seconds_spent": int, "scroll_ratio": float}
    Awards XP and refreshes the streak the first time a lesson is completed.
    """
    lesson = get_object_or_404(Lesson.objects.select_related("module"), slug=slug, **(
        {"module__slug": request.data["module"]} if request.data.get("module") else {}
    ))
    progress, _ = LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)

    progress.seconds_spent += max(0, int(request.data.get("seconds_spent", 0) or 0))
    progress.scroll_ratio = max(progress.scroll_ratio, float(request.data.get("scroll_ratio", 0) or 0))
    progress.save(update_fields=["seconds_spent", "scroll_ratio", "updated_at"])

    awarded_xp = 0
    new_badges = []
    if request.data.get("status") == LessonProgress.STATUS_COMPLETED and progress.mark_completed():
        awarded_xp = lesson.xp_reward
        request.user.award_xp(awarded_xp)
        request.user.touch_streak()
        new_badges = evaluate_badges(request.user)

    return Response(
        {
            "progress": LessonProgressSerializer(progress).data,
            "awarded_xp": awarded_xp,
            "xp": request.user.xp,
            "current_streak": request.user.current_streak,
            "new_badges": BadgeSerializer(new_badges, many=True).data,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_quiz(request, module_slug: str):
    """Grade a quiz server-side. The client never receives the answer key."""
    quiz = get_object_or_404(
        Quiz.objects.prefetch_related("questions__choices"), module__slug=module_slug
    )
    payload = QuizSubmissionSerializer(data=request.data)
    payload.is_valid(raise_exception=True)
    answers = payload.validated_data["answers"]

    details = []
    correct_count = 0
    # Only MCQ questions are graded; open questions are self-assessed flashcards.
    questions = [q for q in quiz.questions.all() if q.kind == "mcq"]
    for question in questions:
        given = answers.get(str(question.id)) or answers.get(question.id)
        correct = next((c for c in question.choices.all() if c.is_correct), None)
        is_correct = correct is not None and given == correct.id
        correct_count += int(is_correct)
        details.append(
            {
                "question_id": question.id,
                "given_choice_id": given,
                "correct_choice_id": correct.id if correct else None,
                "is_correct": is_correct,
                "explanation": question.explanation,
            }
        )

    total = len(questions)
    score = round(correct_count * 100 / total) if total else 0
    attempt = QuizAttempt.objects.create(
        user=request.user,
        quiz=quiz,
        score=score,
        correct_count=correct_count,
        total_count=total,
        passed=score >= quiz.pass_score,
        answers={str(k): v for k, v in answers.items()},
    )

    awarded_xp = 0
    if attempt.passed and QuizAttempt.objects.filter(user=request.user, quiz=quiz, passed=True).count() == 1:
        awarded_xp = quiz.xp_reward
        request.user.award_xp(awarded_xp)
    request.user.touch_streak()
    new_badges = evaluate_badges(request.user)

    return Response(
        {
            "attempt": QuizAttemptSerializer(attempt).data,
            "details": details,
            "awarded_xp": awarded_xp,
            "xp": request.user.xp,
            "new_badges": BadgeSerializer(new_badges, many=True).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def quiz_attempts(request):
    qs = QuizAttempt.objects.filter(user=request.user).select_related("quiz", "quiz__module")
    module_slug = request.query_params.get("module")
    if module_slug:
        qs = qs.filter(quiz__module__slug=module_slug)
    return Response(QuizAttemptSerializer(qs, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard(request):
    return Response(dashboard_payload(request.user))


# ------------------------------------------------------------------ flashcards


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def flashcard_session(request):
    """The cards to review right now.

    Mixes cards already scheduled and due, then tops the session up with new
    ones drawn from the modules the learner has actually started — reviewing a
    question from a module never opened would be pointless.
    """
    limit = min(int(request.query_params.get("limit", 15) or 15), 40)
    today = timezone.localdate()

    due = list(
        FlashcardReview.objects.filter(user=request.user, due_on__lte=today)
        .select_related("question", "question__quiz__module")
        .prefetch_related("question__choices")[:limit]
    )

    if len(due) < limit:
        started_modules = LessonProgress.objects.filter(user=request.user).values(
            "lesson__module_id"
        )
        seen = FlashcardReview.objects.filter(user=request.user).values("question_id")
        fresh = (
            Question.objects.filter(quiz__module_id__in=started_modules)
            .exclude(id__in=seen)
            .select_related("quiz__module")
            .prefetch_related("choices")
            .order_by("quiz__module__order", "order")[: limit - len(due)]
        )
        for question in fresh:
            review, _ = FlashcardReview.objects.get_or_create(user=request.user, question=question)
            due.append(review)

    return Response(
        {
            "cards": FlashcardSerializer(due, many=True).data,
            "stats": flashcard_stats(request.user),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def flashcard_grade(request, question_id: int):
    """Body: {"grade": 0 | 3 | 4 | 5} — SM-2 recall quality."""
    payload = FlashcardGradeSerializer(data=request.data)
    payload.is_valid(raise_exception=True)

    question = get_object_or_404(Question, pk=question_id)
    review, _ = FlashcardReview.objects.get_or_create(user=request.user, question=question)
    review.grade(payload.validated_data["grade"])
    request.user.touch_streak()

    return Response(
        {
            "review": FlashcardSerializer(review).data,
            "stats": flashcard_stats(request.user),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def flashcard_overview(request):
    return Response(flashcard_stats(request.user))


# ----------------------------------------------------------------- classement


@api_view(["GET"])
def leaderboard(request):
    """Top learners by XP, plus the caller's own rank when authenticated."""
    rows = list(
        get_user_model()
        .objects.filter(is_active=True, xp__gt=0)
        .order_by("-xp", "date_joined")
        .values("id", "username", "display_name", "avatar_url", "xp", "current_streak")[:20]
    )
    entries = [
        {
            "rank": index + 1,
            "display_name": row["display_name"] or row["username"],
            "avatar_url": row["avatar_url"],
            "xp": row["xp"],
            "current_streak": row["current_streak"],
            "is_me": request.user.is_authenticated and row["id"] == request.user.id,
        }
        for index, row in enumerate(rows)
    ]

    my_rank = None
    if request.user.is_authenticated and request.user.xp > 0:
        ahead = (
            get_user_model()
            .objects.filter(is_active=True, xp__gt=request.user.xp)
            .count()
        )
        my_rank = ahead + 1

    return Response({"entries": entries, "my_rank": my_rank, "total": len(rows)})


# --------------------------------------------------------------- certificats


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def certificates(request):
    """One certificate per fully completed track."""
    per_module = module_progress_map(request.user)
    payload = []
    for track in Track.objects.order_by("order"):
        modules = list(track.modules.all())
        if not modules:
            continue
        completed = [m for m in modules if per_module.get(m.id, {}).get("completed")]
        # `completed_at` can be null on rows created outside the normal flow
        # (admin, import), so fall back to the last update.
        finished_at = (
            LessonProgress.objects.filter(
                user=request.user,
                lesson__module__track=track,
                status=LessonProgress.STATUS_COMPLETED,
            )
            .annotate(finished=Coalesce("completed_at", "updated_at"))
            .order_by("-finished")
            .values_list("finished", flat=True)
            .first()
        )
        payload.append(
            {
                "track_slug": track.slug,
                "track_title": track.title,
                "track_color": track.color,
                "modules_total": len(modules),
                "modules_completed": len(completed),
                "earned": len(completed) == len(modules),
                "earned_on": finished_at,
                "hours": round(sum(m.estimated_minutes for m in modules) / 60),
            }
        )
    return Response(payload)
