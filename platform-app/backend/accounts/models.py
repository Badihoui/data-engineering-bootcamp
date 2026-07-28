from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Learner account. Email is the login identifier."""

    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    avatar_url = models.URLField(blank=True)
    bio = models.TextField(blank=True)
    job_title = models.CharField(max_length=120, blank=True)
    xp = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_activity_on = models.DateField(null=True, blank=True)
    weekly_goal_minutes = models.PositiveIntegerField(default=300)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self) -> str:
        return self.display_name or self.email

    def touch_streak(self) -> None:
        """Update the daily streak counters. Idempotent within a single day."""
        today = timezone.localdate()
        if self.last_activity_on == today:
            return
        if self.last_activity_on and (today - self.last_activity_on).days == 1:
            self.current_streak += 1
        else:
            self.current_streak = 1
        self.longest_streak = max(self.longest_streak, self.current_streak)
        self.last_activity_on = today
        self.save(update_fields=["current_streak", "longest_streak", "last_activity_on"])

    def award_xp(self, amount: int) -> None:
        User.objects.filter(pk=self.pk).update(xp=models.F("xp") + amount)
        self.refresh_from_db(fields=["xp"])


class Badge(models.Model):
    """An achievement a learner can unlock."""

    RULE_CHOICES = [
        ("modules_completed", "Modules terminés"),
        ("track_completed", "Parcours terminé"),
        ("quiz_perfect", "Quiz parfaits"),
        ("streak_days", "Jours consécutifs"),
        ("xp_total", "XP cumulés"),
    ]

    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=16, default="🏅")
    color = models.CharField(max_length=20, default="#38bdf8")
    rule = models.CharField(max_length=40, choices=RULE_CHOICES)
    threshold = models.PositiveIntegerField(default=1)
    rule_scope = models.CharField(
        max_length=60, blank=True, help_text="Slug du parcours pour rule=track_completed"
    )

    class Meta:
        ordering = ["threshold", "slug"]

    def __str__(self) -> str:
        return self.name


class UserBadge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="badges")
    badge = models.ForeignKey(Badge, on_delete=models.CASCADE, related_name="holders")
    unlocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "badge")
        ordering = ["-unlocked_at"]

    def __str__(self) -> str:
        return f"{self.user} → {self.badge}"
