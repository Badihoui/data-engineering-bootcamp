from django.db.models import Count, Q, Sum
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Diagram, Lesson, Module, Track
from .serializers import (
    DiagramSerializer,
    LessonDetailSerializer,
    LessonListSerializer,
    ModuleDetailSerializer,
    ModuleListSerializer,
    TrackDetailSerializer,
    TrackSerializer,
)


class TrackViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    queryset = (
        Track.objects.annotate(
            module_count=Count("modules", distinct=True),
            total_minutes=Sum("modules__estimated_minutes"),
        )
        .prefetch_related("modules__track")
        .order_by("order")
    )

    def get_serializer_class(self):
        return TrackDetailSerializer if self.action == "retrieve" else TrackSerializer


class ModuleViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    filterset_fields = ["track__slug", "kind", "difficulty"]
    search_fields = ["title", "subtitle", "summary", "tags"]
    ordering_fields = ["order", "number", "estimated_minutes", "difficulty"]
    pagination_class = None

    def get_queryset(self):
        qs = (
            Module.objects.filter(is_published=True)
            .select_related("track")
            .annotate(lesson_count=Count("lessons", distinct=True))
            .order_by("order")
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("lessons", "resources", "quiz__questions__choices")
        return qs

    def get_serializer_class(self):
        return ModuleDetailSerializer if self.action == "retrieve" else ModuleListSerializer


class LessonViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "slug"
    pagination_class = None
    filterset_fields = ["module__slug"]
    search_fields = ["title", "summary"]

    def get_queryset(self):
        return Lesson.objects.select_related("module", "module__track").order_by(
            "module__order", "order"
        )

    def get_serializer_class(self):
        return LessonDetailSerializer if self.action == "retrieve" else LessonListSerializer

    def get_object(self):
        """Lesson slugs are unique per module, so scope by module when given."""
        qs = self.get_queryset()
        module_slug = self.request.query_params.get("module")
        if module_slug:
            qs = qs.filter(module__slug=module_slug)
        obj = qs.filter(slug=self.kwargs["slug"]).first()
        if obj is None:
            from django.http import Http404

            raise Http404("Leçon introuvable")
        return obj


class DiagramViewSet(viewsets.ReadOnlyModelViewSet):
    lookup_field = "key"
    serializer_class = DiagramSerializer
    pagination_class = None
    queryset = Diagram.objects.select_related("module").all()
    filterset_fields = ["fmt", "module__slug"]


@api_view(["GET"])
def search(request):
    """Cross-catalog search powering the ⌘K palette.

    Returns modules and lessons in one payload, ranked so exact title matches
    surface first. Deliberately capped — the palette shows a shortlist, not a
    results page.
    """
    query = (request.query_params.get("q") or "").strip()
    if len(query) < 2:
        return Response({"modules": [], "lessons": [], "query": query})

    modules = (
        Module.objects.filter(is_published=True)
        .filter(Q(title__icontains=query) | Q(summary__icontains=query) | Q(tags__icontains=query))
        .select_related("track")
        .order_by("order")[:8]
    )
    lessons = (
        Lesson.objects.filter(Q(title__icontains=query) | Q(summary__icontains=query))
        .select_related("module", "module__track")
        .order_by("module__order", "order")[:12]
    )

    def rank(title: str) -> int:
        low = title.lower()
        needle = query.lower()
        if low == needle:
            return 0
        if low.startswith(needle):
            return 1
        return 2

    return Response(
        {
            "query": query,
            "modules": sorted(
                (
                    {
                        "slug": module.slug,
                        "number": module.number,
                        "title": module.title,
                        "icon": module.icon,
                        "kind": module.kind,
                        "track_title": module.track.title,
                        "track_color": module.track.color,
                        "tags": module.tags,
                    }
                    for module in modules
                ),
                key=lambda item: rank(item["title"]),
            ),
            "lessons": sorted(
                (
                    {
                        "slug": lesson.slug,
                        "title": lesson.title,
                        "summary": lesson.summary[:120],
                        "module_slug": lesson.module.slug,
                        "module_title": lesson.module.title,
                        "module_number": lesson.module.number,
                        "track_color": lesson.module.track.color,
                        "estimated_minutes": lesson.estimated_minutes,
                    }
                    for lesson in lessons
                ),
                key=lambda item: rank(item["title"]),
            ),
        }
    )


@api_view(["GET"])
def catalog_stats(request):
    """Aggregate numbers used by the landing page and the dashboard header."""
    modules = Module.objects.filter(is_published=True)
    diagrams = Diagram.objects.all()
    return Response(
        {
            "tracks": Track.objects.count(),
            "modules": modules.filter(kind=Module.KIND_COURSE).count(),
            "projects": modules.filter(kind=Module.KIND_PROJECT).count(),
            "lessons": Lesson.objects.count(),
            "quizzes": modules.filter(quiz__isnull=False).count(),
            "total_minutes": modules.aggregate(total=Sum("estimated_minutes"))["total"] or 0,
            "diagrams": diagrams.count(),
            "diagrams_converted": diagrams.exclude(fmt=Diagram.FORMAT_ASCII).count(),
        }
    )
