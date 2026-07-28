from django.contrib import admin

from .models import Bookmark, Enrollment, LessonProgress, Note, QuizAttempt


@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ["user", "lesson", "status", "seconds_spent", "updated_at"]
    list_filter = ["status", "lesson__module__track"]


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ["user", "quiz", "score", "passed", "created_at"]
    list_filter = ["passed"]


admin.site.register([Enrollment, Note, Bookmark])
