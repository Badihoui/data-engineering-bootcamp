"""Business rules shared by the learning API: progress rollups and badges."""

from __future__ import annotations

from django.db.models import Count, Sum

from accounts.models import Badge, UserBadge
from catalog.models import Lesson, Module, Question, Track

from .models import LessonProgress, QuizAttempt


def completed_lesson_ids(user) -> set[int]:
    return set(
        LessonProgress.objects.filter(
            user=user, status=LessonProgress.STATUS_COMPLETED
        ).values_list("lesson_id", flat=True)
    )


def module_progress_map(user) -> dict[int, dict]:
    """Per-module {done, total, percent, quiz_passed} for the given user."""
    totals = dict(
        Module.objects.annotate(total=Count("lessons")).values_list("id", "total")
    )
    done_rows = (
        LessonProgress.objects.filter(user=user, status=LessonProgress.STATUS_COMPLETED)
        .values("lesson__module_id")
        .annotate(done=Count("id"))
    )
    done = {row["lesson__module_id"]: row["done"] for row in done_rows}
    passed_modules = set(
        QuizAttempt.objects.filter(user=user, passed=True).values_list("quiz__module_id", flat=True)
    )

    result: dict[int, dict] = {}
    for module_id, total in totals.items():
        d = done.get(module_id, 0)
        result[module_id] = {
            "done": d,
            "total": total,
            "percent": round(d * 100 / total) if total else 0,
            "quiz_passed": module_id in passed_modules,
            "completed": bool(total) and d >= total,
        }
    return result


def track_progress_map(user) -> dict[int, dict]:
    modules = Module.objects.values("id", "track_id")
    per_module = module_progress_map(user)
    agg: dict[int, dict] = {}
    for row in modules:
        bucket = agg.setdefault(row["track_id"], {"done": 0, "total": 0, "modules_done": 0, "modules": 0})
        stats = per_module.get(row["id"], {"done": 0, "total": 0, "completed": False})
        bucket["done"] += stats["done"]
        bucket["total"] += stats["total"]
        bucket["modules"] += 1
        bucket["modules_done"] += 1 if stats["completed"] else 0
    for bucket in agg.values():
        bucket["percent"] = round(bucket["done"] * 100 / bucket["total"]) if bucket["total"] else 0
    return agg


def evaluate_badges(user) -> list[Badge]:
    """Unlock every badge whose rule is now satisfied. Returns the new ones."""
    per_module = module_progress_map(user)
    modules_completed = sum(1 for s in per_module.values() if s["completed"])
    perfect_quizzes = QuizAttempt.objects.filter(user=user, score=100).values("quiz_id").distinct().count()
    tracks_done = {
        track.slug
        for track in Track.objects.all()
        if track.modules.exists()
        and all(per_module.get(m.id, {}).get("completed") for m in track.modules.all())
    }

    already = set(UserBadge.objects.filter(user=user).values_list("badge__slug", flat=True))
    newly: list[Badge] = []
    for badge in Badge.objects.all():
        if badge.slug in already:
            continue
        ok = False
        if badge.rule == "modules_completed":
            ok = modules_completed >= badge.threshold
        elif badge.rule == "quiz_perfect":
            ok = perfect_quizzes >= badge.threshold
        elif badge.rule == "streak_days":
            ok = user.current_streak >= badge.threshold
        elif badge.rule == "xp_total":
            ok = user.xp >= badge.threshold
        elif badge.rule == "track_completed":
            ok = badge.rule_scope in tracks_done
        if ok:
            UserBadge.objects.create(user=user, badge=badge)
            newly.append(badge)
    return newly


def flashcard_stats(user) -> dict:
    """Counts driving the review screen: what is due, learning, and consolidated."""
    from django.utils import timezone

    from .models import FlashcardReview

    today = timezone.localdate()
    reviews = FlashcardReview.objects.filter(user=user)
    started_modules = LessonProgress.objects.filter(user=user).values("lesson__module_id")

    available = Question.objects.filter(quiz__module_id__in=started_modules).count()
    scheduled = reviews.count()

    return {
        "due": reviews.filter(due_on__lte=today).count(),
        "learning": reviews.filter(interval_days__lt=21, repetitions__gt=0).count(),
        "mature": reviews.filter(interval_days__gte=21).count(),
        "scheduled": scheduled,
        "available": available,
        "new": max(0, available - scheduled),
        "lapses": sum(reviews.values_list("lapses", flat=True)),
    }


def dashboard_payload(user) -> dict:
    per_module = module_progress_map(user)
    per_track = track_progress_map(user)
    lessons_total = Lesson.objects.count()
    lessons_done = sum(s["done"] for s in per_module.values())
    seconds_spent = (
        LessonProgress.objects.filter(user=user).aggregate(total=Sum("seconds_spent"))["total"] or 0
    )

    recent = (
        LessonProgress.objects.filter(user=user)
        .select_related("lesson", "lesson__module")
        .order_by("-updated_at")[:5]
    )
    next_lesson = (
        Lesson.objects.exclude(
            id__in=LessonProgress.objects.filter(
                user=user, status=LessonProgress.STATUS_COMPLETED
            ).values("lesson_id")
        )
        .select_related("module", "module__track")
        .order_by("module__order", "order")
        .first()
    )

    return {
        "xp": user.xp,
        "current_streak": user.current_streak,
        "longest_streak": user.longest_streak,
        "lessons_done": lessons_done,
        "lessons_total": lessons_total,
        "percent": round(lessons_done * 100 / lessons_total) if lessons_total else 0,
        "modules_completed": sum(1 for s in per_module.values() if s["completed"]),
        "modules_total": len(per_module),
        "quizzes_passed": QuizAttempt.objects.filter(user=user, passed=True)
        .values("quiz_id")
        .distinct()
        .count(),
        "seconds_spent": seconds_spent,
        "tracks": {
            track.slug: {
                "title": track.title,
                "color": track.color,
                **per_track.get(track.id, {"done": 0, "total": 0, "percent": 0, "modules": 0, "modules_done": 0}),
            }
            for track in Track.objects.order_by("order")
        },
        "recent": [
            {
                "lesson_slug": p.lesson.slug,
                "lesson_title": p.lesson.title,
                "module_slug": p.lesson.module.slug,
                "module_title": p.lesson.module.title,
                "status": p.status,
                "updated_at": p.updated_at,
            }
            for p in recent
        ],
        "next_lesson": (
            {
                "lesson_slug": next_lesson.slug,
                "lesson_title": next_lesson.title,
                "module_slug": next_lesson.module.slug,
                "module_title": next_lesson.module.title,
                "track_slug": next_lesson.module.track.slug,
            }
            if next_lesson
            else None
        ),
    }
