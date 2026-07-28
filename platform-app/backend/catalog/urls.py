from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DiagramViewSet,
    LessonViewSet,
    ModuleViewSet,
    TrackViewSet,
    catalog_stats,
    search,
)

router = DefaultRouter()
router.register("tracks", TrackViewSet, basename="track")
router.register("modules", ModuleViewSet, basename="module")
router.register("lessons", LessonViewSet, basename="lesson")
router.register("diagrams", DiagramViewSet, basename="diagram")

urlpatterns = [
    path("stats/", catalog_stats, name="catalog-stats"),
    path("search/", search, name="catalog-search"),
    path("", include(router.urls)),
]
