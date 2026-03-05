"""Drop all scheduling_* tables and clear migration records."""
import os
import django

os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings"
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # Find all scheduling tables
    cursor.execute(
        "SELECT tablename FROM pg_tables "
        "WHERE schemaname='public' AND tablename LIKE 'scheduling_%%'"
    )
    tables = [row[0] for row in cursor.fetchall()]
    print(f"Found {len(tables)} scheduling tables: {tables}")

    # Drop each table
    for t in tables:
        cursor.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE')
        print(f"  Dropped: {t}")

    # Clear migration records
    cursor.execute("DELETE FROM django_migrations WHERE app='scheduling'")
    print("Cleared scheduling migration records from django_migrations.")

print("Done! Database is clean for fresh migrations.")
