from django.apps import AppConfig


class SchedulingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "scheduling"
    verbose_name = "Timetable Scheduling"

    def ready(self):
        # Import signals so receivers are registered when Django starts.
        import scheduling.signals  # noqa: F401
