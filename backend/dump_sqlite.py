"""
Dump data from SQLite, ignoring the .env DATABASE_URL.
Forces Django to use the default SQLite database.
"""
import os
import sys
import django

# Remove DATABASE_URL so Django falls back to SQLite
os.environ.pop("DATABASE_URL", None)

# Make sure dotenv doesn't override
os.environ["DATABASE_URL"] = ""

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Patch: override DATABASES before Django fully initializes
django.setup()

from django.conf import settings
# Force SQLite
settings.DATABASES["default"] = {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": os.path.join(settings.BASE_DIR, "db.sqlite3"),
}

from django.core.management import call_command

print("Dumping data from SQLite database...")
call_command(
    "dumpdata",
    "--natural-foreign",
    "--natural-primary",
    "--exclude=contenttypes",
    "--exclude=auth.Permission",
    "--exclude=admin.logentry",
    "--exclude=sessions.session",
    "--exclude=django_q",
    "--indent=2",
    output="data_dump.json",
)
print("Done! Data saved to data_dump.json")
