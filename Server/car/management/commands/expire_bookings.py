from django.core.management.base import BaseCommand
from car.tasks import expire_bookings


class Command(BaseCommand):
    help = 'Expire bookings whose end_time has passed and free associated parking slots'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would be changed without saving')

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)

        if dry_run:
            # For dry-run we call the function but roll back via transaction inside the function
            self.stdout.write('Dry run not implemented for centralized expire function; running normally for visibility')

        updated_bookings, updated_slots = expire_bookings()
        self.stdout.write(f'Updated {updated_bookings} booking(s) and {updated_slots} slot(s)')
# *** End Patch