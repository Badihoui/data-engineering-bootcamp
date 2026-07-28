from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    BookmarkViewSet,
    EnrollmentViewSet,
    NoteViewSet,
    certificates,
    dashboard,
    flashcard_grade,
    flashcard_overview,
    flashcard_session,
    leaderboard,
    my_progress,
    quiz_attempts,
    submit_quiz,
    track_lesson,
)

router = DefaultRouter()
router.register("notes", NoteViewSet, basename="note")
router.register("bookmarks", BookmarkViewSet, basename="bookmark")
router.register("enrollments", EnrollmentViewSet, basename="enrollment")

urlpatterns = [
    path("me/dashboard/", dashboard, name="dashboard"),
    path("me/certificates/", certificates, name="certificates"),
    path("me/flashcards/", flashcard_session, name="flashcard-session"),
    path("me/flashcards/stats/", flashcard_overview, name="flashcard-stats"),
    path("me/flashcards/<int:question_id>/grade/", flashcard_grade, name="flashcard-grade"),
    path("leaderboard/", leaderboard, name="leaderboard"),
    path("me/progress/", my_progress, name="my-progress"),
    path("me/quiz-attempts/", quiz_attempts, name="quiz-attempts"),
    path("lessons/<slug:slug>/track/", track_lesson, name="track-lesson"),
    path("modules/<slug:module_slug>/quiz/submit/", submit_quiz, name="submit-quiz"),
    path("", include(router.urls)),
]
