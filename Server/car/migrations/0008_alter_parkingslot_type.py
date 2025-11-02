# No-op migration to neutralize an accidental schema change.
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('car', '0007_alter_booking_status'),
    ]

    operations = [
        # Intentionally left blank: this migration performs no database operations.
    ]
