"""
Migration to add `archived` boolean columns to `car_booking` and `car_payment`.

This migration uses direct SQL `ALTER TABLE ADD COLUMN` so it is safe on
SQLite (it won't attempt to remake the table which previously caused a
NOT NULL constraint failure when copying rows).

If you later run this against other DB backends (Postgres/MySQL), Django's
standard AddField would work; here we prefer a direct SQL approach to avoid
the SQLite table-copy issue in local development.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("car", "0011_notification"),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE car_booking ADD COLUMN archived boolean NOT NULL DEFAULT 0;"
            ),
            reverse_sql=(
                "ALTER TABLE car_booking DROP COLUMN archived;"
            ),
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE car_payment ADD COLUMN archived boolean NOT NULL DEFAULT 0;"
            ),
            reverse_sql=(
                "ALTER TABLE car_payment DROP COLUMN archived;"
            ),
        ),
    ]
