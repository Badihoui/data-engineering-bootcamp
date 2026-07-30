from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path, re_path

from .spa import SpaView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("catalog.urls")),
    path("api/", include("learning.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Doit rester en dernier : intercepte tout ce que l'API n'a pas pris.
if settings.SERVE_SPA:
    urlpatterns += [re_path(r"^(?P<path>.*)$", SpaView.as_view(), name="spa")]
