"""Learner-side state: enrolments, progress, quiz attempts, notes, flashcards."""

from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from catalog.models import Lesson, Module, Question, Quiz, Track


class Enrollment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments"
    )
    track = models.ForeignKey(Track, on_delete=models.CASCADE, related_name="enrollments")
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "track")

    def __str__(self) -> str:
        return f"{self.user} → {self.track}"


class LessonProgress(models.Model):
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED = "completed"
    STATUS_CHOICES = [
        (STATUS_IN_PROGRESS, "En cours"),
        (STATUS_COMPLETED, "Terminé"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_progress"
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="progress")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_IN_PROGRESS)
    seconds_spent = models.PositiveIntegerField(default=0)
    scroll_ratio = models.FloatField(default=0.0)
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "lesson")
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"{self.user} — {self.lesson} ({self.status})"

    def mark_completed(self) -> bool:
        """Returns True the first time the lesson flips to completed."""
        if self.status == self.STATUS_COMPLETED:
            return False
        self.status = self.STATUS_COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at", "updated_at"])
        return True


class QuizAttempt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quiz_attempts"
    )
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="attempts")
    score = models.PositiveSmallIntegerField(default=0, help_text="Score en %")
    correct_count = models.PositiveIntegerField(default=0)
    total_count = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(default=False)
    answers = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user} — {self.quiz} : {self.score}%"


class FlashcardReview(models.Model):
    """Spaced-repetition schedule for one quiz question, for one learner.

    Implements SM-2: the interval grows by the card's ease factor on every
    successful recall, and collapses back to one day as soon as recall fails.
    Cards are the existing quiz questions — no separate content to maintain.
    """

    GRADE_AGAIN = 0
    GRADE_HARD = 3
    GRADE_GOOD = 4
    GRADE_EASY = 5
    GRADE_CHOICES = [
        (GRADE_AGAIN, "Oublié"),
        (GRADE_HARD, "Difficile"),
        (GRADE_GOOD, "Correct"),
        (GRADE_EASY, "Facile"),
    ]

    MIN_EASE = 1.3
    DEFAULT_EASE = 2.5

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="flashcards"
    )
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="reviews")
    ease_factor = models.FloatField(default=DEFAULT_EASE)
    interval_days = models.PositiveIntegerField(default=0)
    repetitions = models.PositiveIntegerField(default=0)
    lapses = models.PositiveIntegerField(default=0)
    due_on = models.DateField(default=timezone.localdate)
    last_grade = models.PositiveSmallIntegerField(null=True, blank=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "question")
        ordering = ["due_on", "id"]

    def __str__(self) -> str:
        return f"{self.user} — {self.question} (le {self.due_on})"

    @property
    def is_mature(self) -> bool:
        """A card is mature once it survives more than three weeks between reviews."""
        return self.interval_days >= 21

    def grade(self, quality: int) -> None:
        """Applies SM-2 for a recall quality between 0 and 5."""
        quality = max(0, min(5, quality))

        if quality < 3:
            self.repetitions = 0
            self.interval_days = 1
            self.lapses += 1
        else:
            if self.repetitions == 0:
                self.interval_days = 1
            elif self.repetitions == 1:
                self.interval_days = 6
            else:
                self.interval_days = max(1, round(self.interval_days * self.ease_factor))
            self.repetitions += 1

        # The ease factor drifts with recall quality but never below 1.3,
        # otherwise a hard card would be scheduled forever at one-day intervals.
        delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        self.ease_factor = max(self.MIN_EASE, round(self.ease_factor + delta, 4))

        self.last_grade = quality
        self.last_reviewed_at = timezone.now()
        self.due_on = timezone.localdate() + timedelta(days=self.interval_days)
        self.save()


class Note(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes"
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="notes")
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return f"Note de {self.user} sur {self.lesson}"


class Bookmark(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks"
    )
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="bookmarks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "module")
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.user} ★ {self.module}"
