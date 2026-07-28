from django.contrib import admin

from .models import Choice, Diagram, Lesson, Module, Question, Quiz, Resource, Track


class ModuleInline(admin.TabularInline):
    model = Module
    fields = ["number", "title", "kind", "estimated_minutes"]
    extra = 0


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ["order", "title", "slug", "estimated_weeks"]
    inlines = [ModuleInline]


class LessonInline(admin.TabularInline):
    model = Lesson
    fields = ["order", "title", "estimated_minutes", "has_code", "has_diagram"]
    extra = 0


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ["number", "title", "track", "kind", "difficulty", "estimated_minutes"]
    list_filter = ["track", "kind", "difficulty"]
    search_fields = ["title", "summary"]
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["module", "order", "title", "estimated_minutes"]
    list_filter = ["module__track"]
    search_fields = ["title"]


@admin.register(Diagram)
class DiagramAdmin(admin.ModelAdmin):
    list_display = ["key", "title", "module", "fmt"]
    list_filter = ["fmt", "module__track"]
    search_fields = ["key", "title", "source_ascii"]


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 0


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["quiz", "order", "prompt"]
    inlines = [ChoiceInline]


@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ["module", "title", "pass_score", "question_count"]


admin.site.register(Resource)
admin.site.site_header = "Bootcamp Data Engineering — Administration"
admin.site.site_title = "Bootcamp DE"
