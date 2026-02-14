from django.contrib import admin
from .models import TicketMessage

# Register your models here.

@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'ticket', 'sender', 'created_at']
    list_filter = ['ticket', 'sender']
    search_fields = ['message']
