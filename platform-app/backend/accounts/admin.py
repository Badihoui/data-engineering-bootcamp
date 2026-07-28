from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Badge, User, UserBadge


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "username", "display_name", "xp", "current_streak", "is_staff"]
    search_fields = ["email", "username", "display_name"]
    ordering = ["email"]
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Profil bootcamp",
            {
                "fields": (
                    "display_name",
                    "avatar_url",
                    "bio",
                    "job_title",
                    "xp",
                    "current_streak",
                    "longest_streak",
                    "last_activity_on",
                    "weekly_goal_minutes",
                )
            },
        ),
    )


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "rule", "threshold"]


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ["user", "badge", "unlocked_at"]
