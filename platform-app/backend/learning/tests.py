"""Progression, XP, badges and — above all — server-side quiz grading."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import Badge, User, UserBadge
from catalog.models import Choice, Lesson, Module, Question, Quiz, Track

from .models import LessonProgress, QuizAttempt
from .services import dashboard_payload, evaluate_badges, module_progress_map


class Fixture(APITestCase):
    """Builds a two-module track with a graded quiz."""

    def setUp(self) -> None:
        self.track = Track.objects.create(slug="debutant", title="Débutant", order=1)
        self.module = Module.objects.create(
            track=self.track, slug="01-intro", number=1, order=1, title="Introduction"
        )
        self.other = Module.objects.create(
            track=self.track, slug="02-bash", number=2, order=2, title="Bash"
        )
        self.lessons = [
            Lesson.objects.create(
                module=self.module, slug=f"lecon-{i}", order=i, title=f"Leçon {i}", xp_reward=20
            )
            for i in range(1, 4)
        ]
        Lesson.objects.create(module=self.other, slug="unique", order=1, title="Unique")

        self.quiz = Quiz.objects.create(module=self.module, pass_score=70, xp_reward=100)
        self.questions = []
        for index in range(1, 4):
            question = Question.objects.create(
                quiz=self.quiz,
                order=index,
                kind=Question.KIND_MCQ,
                prompt=f"Question {index} ?",
                explanation=f"Parce que {index}.",
            )
            Choice.objects.create(question=question, order=1, label="a", text="Faux", is_correct=False)
            Choice.objects.create(question=question, order=2, label="b", text="Vrai", is_correct=True)
            self.questions.append(question)
        # An open question must never influence the score.
        Question.objects.create(
            quiz=self.quiz, order=4, kind=Question.KIND_OPEN, prompt="Explique.", explanation="Réponse libre."
        )

        self.user = User.objects.create_user(
            username="lea", email="lea@bootcamp.dev", password="MotDePasse2026!"
        )
        self.client.force_authenticate(self.user)

    def correct_answers(self) -> dict:
        return {
            str(question.id): question.choices.get(is_correct=True).id for question in self.questions
        }

    def wrong_answers(self) -> dict:
        return {
            str(question.id): question.choices.get(is_correct=False).id
            for question in self.questions
        }


class QuizGradingTests(Fixture):
    def url(self) -> str:
        return f"/api/modules/{self.module.slug}/quiz/submit/"

    def test_all_correct_scores_100_and_passes(self):
        response = self.client.post(self.url(), {"answers": self.correct_answers()}, format="json")
        self.assertEqual(response.status_code, 201)
        attempt = response.data["attempt"]
        self.assertEqual(attempt["score"], 100)
        self.assertEqual(attempt["correct_count"], 3)
        self.assertTrue(attempt["passed"])

    def test_all_wrong_scores_zero_and_fails(self):
        response = self.client.post(self.url(), {"answers": self.wrong_answers()}, format="json")
        self.assertEqual(response.data["attempt"]["score"], 0)
        self.assertFalse(response.data["attempt"]["passed"])

    def test_partial_score_is_rounded_against_the_pass_mark(self):
        answers = self.correct_answers()
        answers[str(self.questions[0].id)] = self.questions[0].choices.get(is_correct=False).id
        response = self.client.post(self.url(), {"answers": answers}, format="json")
        self.assertEqual(response.data["attempt"]["score"], 67)
        self.assertFalse(response.data["attempt"]["passed"])

    def test_open_questions_are_excluded_from_the_total(self):
        response = self.client.post(self.url(), {"answers": self.correct_answers()}, format="json")
        self.assertEqual(response.data["attempt"]["total_count"], 3)

    def test_details_expose_the_key_only_after_grading(self):
        response = self.client.post(self.url(), {"answers": self.wrong_answers()}, format="json")
        detail = response.data["details"][0]
        self.assertFalse(detail["is_correct"])
        self.assertIsNotNone(detail["correct_choice_id"])
        self.assertIn("Parce que", detail["explanation"])

    def test_answer_key_is_never_serialised_before_the_attempt(self):
        response = self.client.get(f"/api/modules/{self.module.slug}/")
        payload = str(response.data["quiz"])
        self.assertNotIn("is_correct", payload)
        self.assertEqual(response.data["quiz"]["graded_count"], 3)

    def test_open_question_ships_its_answer_but_mcq_does_not(self):
        response = self.client.get(f"/api/modules/{self.module.slug}/")
        by_kind = {q["kind"]: q for q in response.data["quiz"]["questions"]}
        self.assertEqual(by_kind["mcq"]["explanation"], "")
        self.assertEqual(by_kind["open"]["explanation"], "Réponse libre.")

    def test_xp_is_awarded_once_per_quiz(self):
        self.client.post(self.url(), {"answers": self.correct_answers()}, format="json")
        self.user.refresh_from_db()
        first = self.user.xp
        self.assertEqual(first, 100)

        second = self.client.post(self.url(), {"answers": self.correct_answers()}, format="json")
        self.assertEqual(second.data["awarded_xp"], 0)
        self.user.refresh_from_db()
        self.assertEqual(self.user.xp, first)

    def test_every_attempt_is_recorded(self):
        self.client.post(self.url(), {"answers": self.wrong_answers()}, format="json")
        self.client.post(self.url(), {"answers": self.correct_answers()}, format="json")
        self.assertEqual(QuizAttempt.objects.filter(user=self.user).count(), 2)

    def test_missing_answers_count_as_wrong(self):
        response = self.client.post(self.url(), {"answers": {}}, format="json")
        self.assertEqual(response.data["attempt"]["score"], 0)

    def test_anonymous_users_cannot_submit(self):
        self.client.force_authenticate(None)
        response = self.client.post(self.url(), {"answers": {}}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_unknown_module_returns_404(self):
        response = self.client.post("/api/modules/inconnu/quiz/submit/", {"answers": {}}, format="json")
        self.assertEqual(response.status_code, 404)


class LessonProgressTests(Fixture):
    def url(self, lesson: Lesson) -> str:
        return f"/api/lessons/{lesson.slug}/track/"

    def test_completing_a_lesson_awards_its_xp(self):
        response = self.client.post(
            self.url(self.lessons[0]),
            {"module": self.module.slug, "status": "completed"},
            format="json",
        )
        self.assertEqual(response.data["awarded_xp"], 20)
        self.assertEqual(response.data["xp"], 20)

    def test_completing_twice_does_not_award_twice(self):
        payload = {"module": self.module.slug, "status": "completed"}
        self.client.post(self.url(self.lessons[0]), payload, format="json")
        second = self.client.post(self.url(self.lessons[0]), payload, format="json")
        self.assertEqual(second.data["awarded_xp"], 0)
        self.assertEqual(second.data["xp"], 20)

    def test_time_spent_accumulates(self):
        for _ in range(3):
            self.client.post(
                self.url(self.lessons[0]),
                {"module": self.module.slug, "seconds_spent": 40},
                format="json",
            )
        progress = LessonProgress.objects.get(user=self.user, lesson=self.lessons[0])
        self.assertEqual(progress.seconds_spent, 120)
        self.assertEqual(progress.status, LessonProgress.STATUS_IN_PROGRESS)

    def test_streak_starts_at_one(self):
        self.client.post(
            self.url(self.lessons[0]),
            {"module": self.module.slug, "status": "completed"},
            format="json",
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.current_streak, 1)

    def test_streak_increments_on_consecutive_days(self):
        self.user.last_activity_on = timezone.localdate() - timedelta(days=1)
        self.user.current_streak = 4
        self.user.save()
        self.user.touch_streak()
        self.assertEqual(self.user.current_streak, 5)
        self.assertEqual(self.user.longest_streak, 5)

    def test_streak_resets_after_a_gap(self):
        self.user.last_activity_on = timezone.localdate() - timedelta(days=3)
        self.user.current_streak = 9
        self.user.longest_streak = 9
        self.user.save()
        self.user.touch_streak()
        self.assertEqual(self.user.current_streak, 1)
        self.assertEqual(self.user.longest_streak, 9)

    def test_lesson_slug_is_scoped_by_module(self):
        """Two modules may hold lessons with the same slug."""
        twin = Lesson.objects.create(
            module=self.other, slug="lecon-1", order=2, title="Homonyme", xp_reward=5
        )
        response = self.client.post(
            f"/api/lessons/{twin.slug}/track/",
            {"module": self.other.slug, "status": "completed"},
            format="json",
        )
        self.assertEqual(response.data["awarded_xp"], 5)


class ProgressRollupTests(Fixture):
    def complete(self, *lessons: Lesson) -> None:
        for lesson in lessons:
            LessonProgress.objects.create(
                user=self.user, lesson=lesson, status=LessonProgress.STATUS_COMPLETED
            )

    def test_module_percentage(self):
        self.complete(self.lessons[0], self.lessons[1])
        stats = module_progress_map(self.user)[self.module.id]
        self.assertEqual(stats["done"], 2)
        self.assertEqual(stats["total"], 3)
        self.assertEqual(stats["percent"], 67)
        self.assertFalse(stats["completed"])

    def test_module_marked_complete_when_all_lessons_done(self):
        self.complete(*self.lessons)
        self.assertTrue(module_progress_map(self.user)[self.module.id]["completed"])

    def test_dashboard_reports_the_next_lesson(self):
        self.complete(self.lessons[0])
        payload = dashboard_payload(self.user)
        self.assertEqual(payload["lessons_done"], 1)
        self.assertEqual(payload["next_lesson"]["lesson_slug"], "lecon-2")

    def test_dashboard_is_empty_but_valid_for_a_new_user(self):
        payload = dashboard_payload(self.user)
        self.assertEqual(payload["percent"], 0)
        self.assertEqual(payload["modules_completed"], 0)
        self.assertIsNotNone(payload["next_lesson"])

    def test_progress_endpoint_returns_lessons_and_modules(self):
        self.complete(self.lessons[0])
        response = self.client.get("/api/me/progress/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["lessons"]), 1)
        self.assertIn(str(self.module.id), {str(k) for k in response.data["modules"]})


class BadgeTests(Fixture):
    def setUp(self) -> None:
        super().setUp()
        Badge.objects.create(
            slug="premier-pas", name="Premier pas", rule="modules_completed", threshold=1
        )
        Badge.objects.create(
            slug="fondations", name="Fondations", rule="track_completed", rule_scope="debutant"
        )
        Badge.objects.create(slug="serie-7", name="Série", rule="streak_days", threshold=7)

    def test_first_module_unlocks_its_badge(self):
        for lesson in self.lessons:
            LessonProgress.objects.create(
                user=self.user, lesson=lesson, status=LessonProgress.STATUS_COMPLETED
            )
        unlocked = evaluate_badges(self.user)
        self.assertIn("premier-pas", [badge.slug for badge in unlocked])

    def test_track_badge_needs_every_module(self):
        for lesson in self.lessons:
            LessonProgress.objects.create(
                user=self.user, lesson=lesson, status=LessonProgress.STATUS_COMPLETED
            )
        self.assertNotIn("fondations", [badge.slug for badge in evaluate_badges(self.user)])

        LessonProgress.objects.create(
            user=self.user,
            lesson=Lesson.objects.get(module=self.other, slug="unique"),
            status=LessonProgress.STATUS_COMPLETED,
        )
        self.assertIn("fondations", [badge.slug for badge in evaluate_badges(self.user)])

    def test_badges_are_never_awarded_twice(self):
        for lesson in self.lessons:
            LessonProgress.objects.create(
                user=self.user, lesson=lesson, status=LessonProgress.STATUS_COMPLETED
            )
        evaluate_badges(self.user)
        self.assertEqual(evaluate_badges(self.user), [])
        self.assertEqual(UserBadge.objects.filter(user=self.user).count(), 1)

    def test_streak_badge_uses_the_current_streak(self):
        self.user.current_streak = 7
        self.user.save()
        self.assertIn("serie-7", [badge.slug for badge in evaluate_badges(self.user)])


class CatalogApiTests(Fixture):
    def test_module_list_is_public(self):
        self.client.force_authenticate(None)
        response = self.client.get("/api/modules/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_module_list_exposes_the_lesson_count(self):
        response = self.client.get("/api/modules/")
        by_slug = {module["slug"]: module for module in response.data}
        self.assertEqual(by_slug["01-intro"]["lesson_count"], 3)
        self.assertTrue(by_slug["01-intro"]["has_quiz"])
        self.assertFalse(by_slug["02-bash"]["has_quiz"])

    def test_lesson_detail_carries_its_neighbours(self):
        response = self.client.get(f"/api/lessons/lecon-2/?module={self.module.slug}")
        self.assertEqual(response.data["neighbours"]["previous"]["slug"], "lecon-1")
        self.assertEqual(response.data["neighbours"]["next"]["slug"], "lecon-3")

    def test_first_lesson_has_no_previous(self):
        response = self.client.get(f"/api/lessons/lecon-1/?module={self.module.slug}")
        self.assertIsNone(response.data["neighbours"]["previous"])

    def test_stats_endpoint_counts_the_catalog(self):
        response = self.client.get("/api/stats/")
        self.assertEqual(response.data["modules"], 2)
        self.assertEqual(response.data["lessons"], 4)
        self.assertEqual(response.data["quizzes"], 1)

    def test_dashboard_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/me/dashboard/").status_code, 401)


class AuthTests(APITestCase):
    def test_registration_then_login_returns_the_user(self):
        payload = {
            "email": "nouveau@bootcamp.dev",
            "username": "nouveau",
            "display_name": "Nouveau",
            "password": "MotDePasse2026!",
        }
        self.assertEqual(self.client.post("/api/auth/register/", payload, format="json").status_code, 201)

        response = self.client.post(
            "/api/auth/login/",
            {"email": payload["email"], "password": payload["password"]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["display_name"], "Nouveau")

    def test_duplicate_username_is_rejected(self):
        User.objects.create_user(username="pris", email="pris@bootcamp.dev", password="MotDePasse2026!")
        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "autre@bootcamp.dev",
                "username": "pris",
                "display_name": "Autre",
                "password": "MotDePasse2026!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_weak_password_is_rejected(self):
        response = self.client.post(
            "/api/auth/register/",
            {"email": "faible@bootcamp.dev", "username": "faible", "display_name": "F", "password": "1234"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_profile_can_be_updated(self):
        user = User.objects.create_user(
            username="lea", email="lea@bootcamp.dev", password="MotDePasse2026!"
        )
        self.client.force_authenticate(user)
        response = self.client.patch("/api/auth/me/", {"job_title": "Data Analyst"}, format="json")
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.job_title, "Data Analyst")

    def test_xp_is_read_only_from_the_api(self):
        user = User.objects.create_user(
            username="lea", email="lea@bootcamp.dev", password="MotDePasse2026!"
        )
        self.client.force_authenticate(user)
        self.client.patch("/api/auth/me/", {"xp": 99999}, format="json")
        user.refresh_from_db()
        self.assertEqual(user.xp, 0)


class FlashcardTests(Fixture):
    """SM-2 scheduling — the part where an off-by-one ruins months of revision."""

    def card(self) -> "FlashcardReview":
        from .models import FlashcardReview

        review, _ = FlashcardReview.objects.get_or_create(
            user=self.user, question=self.questions[0]
        )
        return review

    def test_a_new_card_is_due_today(self):
        self.assertEqual(self.card().due_on, timezone.localdate())

    def test_first_success_schedules_one_day_later(self):
        review = self.card()
        review.grade(4)
        self.assertEqual(review.interval_days, 1)
        self.assertEqual(review.repetitions, 1)
        self.assertEqual(review.due_on, timezone.localdate() + timedelta(days=1))

    def test_second_success_schedules_six_days_later(self):
        review = self.card()
        review.grade(4)
        review.grade(4)
        self.assertEqual(review.interval_days, 6)
        self.assertEqual(review.repetitions, 2)

    def test_third_success_multiplies_by_the_ease_factor(self):
        review = self.card()
        review.grade(4)
        review.grade(4)
        ease = review.ease_factor
        review.grade(4)
        self.assertEqual(review.interval_days, round(6 * ease))

    def test_failure_resets_the_interval_and_counts_a_lapse(self):
        review = self.card()
        for _ in range(3):
            review.grade(5)
        self.assertGreater(review.interval_days, 6)

        review.grade(0)
        self.assertEqual(review.interval_days, 1)
        self.assertEqual(review.repetitions, 0)
        self.assertEqual(review.lapses, 1)

    def test_easy_answers_raise_the_ease_factor(self):
        review = self.card()
        before = review.ease_factor
        review.grade(5)
        self.assertGreater(review.ease_factor, before)

    def test_hard_answers_lower_it(self):
        review = self.card()
        before = review.ease_factor
        review.grade(3)
        self.assertLess(review.ease_factor, before)

    def test_ease_factor_never_drops_below_the_floor(self):
        review = self.card()
        for _ in range(20):
            review.grade(3)
        self.assertGreaterEqual(review.ease_factor, review.MIN_EASE)

    def test_a_card_becomes_mature_after_three_weeks(self):
        review = self.card()
        self.assertFalse(review.is_mature)
        review.interval_days = 21
        self.assertTrue(review.is_mature)

    def test_session_only_draws_from_started_modules(self):
        response = self.client.get("/api/me/flashcards/")
        self.assertEqual(response.data["cards"], [])

        LessonProgress.objects.create(user=self.user, lesson=self.lessons[0])
        response = self.client.get("/api/me/flashcards/")
        self.assertEqual(len(response.data["cards"]), 4)

    def test_session_respects_its_limit(self):
        LessonProgress.objects.create(user=self.user, lesson=self.lessons[0])
        response = self.client.get("/api/me/flashcards/?limit=2")
        self.assertEqual(len(response.data["cards"]), 2)

    def test_cards_carry_their_answer(self):
        LessonProgress.objects.create(user=self.user, lesson=self.lessons[0])
        card = self.client.get("/api/me/flashcards/").data["cards"][0]
        self.assertEqual(card["correct_label"], "b")
        self.assertTrue(card["is_new"])
        self.assertIn("Parce que", card["explanation"])

    def test_grading_through_the_api_reschedules_the_card(self):
        response = self.client.post(
            f"/api/me/flashcards/{self.questions[0].id}/grade/", {"grade": 5}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["review"]["interval_days"], 1)
        self.assertEqual(response.data["stats"]["due"], 0)

    def test_grading_rejects_an_out_of_range_quality(self):
        response = self.client.post(
            f"/api/me/flashcards/{self.questions[0].id}/grade/", {"grade": 2}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_a_graded_card_leaves_the_due_pile(self):
        LessonProgress.objects.create(user=self.user, lesson=self.lessons[0])
        self.client.get("/api/me/flashcards/")
        self.client.post(
            f"/api/me/flashcards/{self.questions[0].id}/grade/", {"grade": 4}, format="json"
        )
        due = [card["question"] for card in self.client.get("/api/me/flashcards/").data["cards"]]
        self.assertNotIn(self.questions[0].id, due)

    def test_stats_split_new_learning_and_mature(self):
        LessonProgress.objects.create(user=self.user, lesson=self.lessons[0])
        stats = self.client.get("/api/me/flashcards/stats/").data
        self.assertEqual(stats["available"], 4)
        self.assertEqual(stats["new"], 4)
        self.assertEqual(stats["mature"], 0)


class LeaderboardTests(Fixture):
    def test_ranks_by_xp_and_flags_the_caller(self):
        rival = User.objects.create_user(
            username="rival", email="rival@bootcamp.dev", password="MotDePasse2026!", xp=500
        )
        self.user.xp = 200
        self.user.save()

        entries = self.client.get("/api/leaderboard/").data["entries"]
        self.assertEqual(entries[0]["display_name"], rival.username)
        self.assertEqual(entries[0]["rank"], 1)
        self.assertTrue(entries[1]["is_me"])

    def test_learners_without_xp_are_hidden(self):
        self.assertEqual(self.client.get("/api/leaderboard/").data["entries"], [])

    def test_reports_my_rank(self):
        User.objects.create_user(
            username="rival", email="rival@bootcamp.dev", password="MotDePasse2026!", xp=900
        )
        self.user.xp = 100
        self.user.save()
        self.assertEqual(self.client.get("/api/leaderboard/").data["my_rank"], 2)

    def test_is_readable_without_an_account(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/leaderboard/").status_code, 200)


class CertificateTests(Fixture):
    def test_not_earned_while_modules_remain(self):
        certificates = self.client.get("/api/me/certificates/").data
        self.assertFalse(certificates[0]["earned"])
        self.assertEqual(certificates[0]["modules_completed"], 0)

    def test_earned_once_every_module_is_complete(self):
        for lesson in Lesson.objects.all():
            LessonProgress.objects.create(
                user=self.user, lesson=lesson, status=LessonProgress.STATUS_COMPLETED
            )
        certificate = self.client.get("/api/me/certificates/").data[0]
        self.assertTrue(certificate["earned"])
        self.assertEqual(certificate["modules_completed"], certificate["modules_total"])
        self.assertIsNotNone(certificate["earned_on"])

    def test_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/me/certificates/").status_code, 401)
