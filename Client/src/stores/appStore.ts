import { create } from 'zustand';
import { AppState, User } from '../types';
import * as usersApi from '../API/usersApi';
import * as slotsApi from '../API/parkingSlotApi';
import * as bookingsApi from '../API/bookingApi';
import * as paymentsApi from '../API/paymentApi';
import * as ticketsApi from '../API/ticketApi';
import * as contactsApi from '../API/contactApi';

export const useAppStore = create<AppState>((set, _get) => ({
  users: [],
  slots: [],
  bookings: [],
  payments: [],
  tickets: [],
  contacts: [],

  // Load latest data from server (called after login or on demand)
  loadFromServer: async () => {
    try {
      const [users, slots, bookings, payments, tickets, contacts] = await Promise.all([
        usersApi.fetchUsers().catch(() => []),
        slotsApi.fetchParkingSlots().catch(() => []),
        bookingsApi.fetchBookings().catch(() => []),
        paymentsApi.fetchPayments().catch(() => []),
        ticketsApi.fetchTickets().catch(() => []),
        contactsApi.fetchContacts().catch(() => []),
      ]);

      // Map API shapes to local store where necessary and ensure types match AppState
      const normalizedBookings = (bookings as any[]).map((b: any) => {
        // prefer server numeric id when present, fall back to original
        const idNum = b.id != null && !Number.isNaN(Number(b.id)) ? Number(b.id) : undefined;
        return {
          id: idNum !== undefined ? idNum : b.id,
          userId: b.userId ?? b.user_id ?? b.user?.id ?? b.user_id_read ?? null,
          slotId: b.slotId ?? b.slot_id ?? null,
          startTime: b.startTime ?? b.start_time ?? null,
          endTime: b.endTime ?? b.end_time ?? null,
          status: b.status,
          amount: typeof b.amount === 'string' ? Number(b.amount) : b.amount,
          paymentId: b.paymentId ?? b.payment_id ?? null,
          createdAt: b.createdAt ?? b.created_at ?? new Date().toISOString(),
          // preserve other fields
          ...b
        } as any;
      });

      set(() => ({
        users: users as any,
        slots: slots as any,
        bookings: normalizedBookings as any,
        payments: payments as any,
        tickets: tickets as any,
        contacts: contacts as any,
      }));
    } catch (err) {
      // Let callers handle retry; for now just log to console in dev
      // console.error('Failed to load data from server', err);
      throw err;
    }
  },

  addUser: (userData) => {
    const newUser = {
      ...userData,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    set(state => ({ users: [...state.users, newUser] }));
  },

  addSlot: (slotData) => {
    const newSlot = {
      ...slotData,
      id: `slot-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      createdAt: new Date().toISOString()
    };
    set(state => ({ slots: [...state.slots, newSlot] }));
  },

  // Replace the entire slots list (used when syncing from API)
  setSlots: (slots) => {
    set(() => ({ slots }));
  },

  // Replace the entire users list (used when syncing from API)
  setUsers: (users: User[]) => {
    set(() => ({ users }));
  },

  // Insert or update a slot by id preserving given id
  upsertSlot: (slot) => {
    set(state => {
      const exists = state.slots.some(s => String(s.id) === String(slot.id));
      if (exists) {
        return { slots: state.slots.map(s => String(s.id) === String(slot.id) ? { ...s, ...slot } : s) };
      }
      return { slots: [...state.slots, slot] };
    });
  },

  updateSlot: (id, updates) => {
    set(state => ({
      slots: state.slots.map(slot => 
        String(slot.id) === String(id) ? { ...slot, ...updates } : slot
      )
    }));
  },

  deleteSlot: (id) => {
    set(state => ({
      slots: state.slots.filter(slot => slot.id !== id)
    }));
  },

  addBooking: (bookingData) => {
    // Ensure temporary/local bookings use a numeric id (timestamp) to match Booking.id type
    const suppliedId = (bookingData as any).id;
    const numericId = suppliedId != null && !Number.isNaN(Number(suppliedId)) ? Number(suppliedId) : Date.now();
    const newBooking = {
      ...bookingData,
      id: numericId,
      createdAt: new Date().toISOString()
    };

    set(state => {
      // Only mark slot as booked immediately for active/completed bookings.
      const shouldMarkSlot = (bookingData as any).status === 'active' || (bookingData as any).status === 'completed';
      return {
        bookings: [...state.bookings, newBooking],
        slots: shouldMarkSlot
          ? state.slots.map(slot => String(slot.id) === String((bookingData as any).slotId) ? { ...slot, isBooked: true } : slot)
          : state.slots
      };
    });
  },

  updateBooking: (id, updates) => {
    set(state => {
      const booking = state.bookings.find(b => String(b.id) === String(id));
      if (booking && updates.status === 'cancelled') {
        return {
          bookings: state.bookings.map(b => 
            String(b.id) === String(id) ? { ...b, ...updates } : b
          ),
          slots: state.slots.map(slot => 
            String(slot.id) === String((booking as any).slotId) 
              ? { ...slot, isBooked: false }
              : slot
          )
        };
      }
      return {
        bookings: state.bookings.map(b => 
          String(b.id) === String(id) ? { ...b, ...updates } : b
        )
      };
    });
  },

  addPayment: (paymentData) => {
    // Prevent duplicate payments by bookingId or transactionId
    set(state => {
      const exists = state.payments.some(p => (
        (paymentData as any).transactionId && p.transactionId === (paymentData as any).transactionId
      ) || (paymentData.bookingId && p.bookingId === (paymentData as any).bookingId));

      if (exists) {
        // return current payments unchanged as a valid partial state
        return { payments: state.payments } as any;
      }

      const newPayment = {
        ...paymentData,
        id: `payment-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      return { payments: [...state.payments, newPayment] };
    });
  },

  addTicket: (ticketData) => {
    const newTicket = {
      ...ticketData,
      id: `ticket-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    set(state => ({ tickets: [...state.tickets, newTicket] }));
  },

  updateTicket: (id, updates) => {
    set(state => ({
      tickets: state.tickets.map(ticket => 
        ticket.id === id 
          ? { ...ticket, ...updates, updatedAt: new Date().toISOString() }
          : ticket
      )
    }));
  },

  addContact: (contactData) => {
    const newContact = {
      ...contactData,
      id: `contact-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    set(state => ({ contacts: [...state.contacts, newContact] }));
  },

  updateContact: (id, updates) => {
    set(state => ({
      contacts: state.contacts.map(contact => 
        contact.id === id ? { ...contact, ...updates } : contact
      )
    }));
  },

  updateUser: (id, updates) => {
    set(state => ({
      users: state.users.map(user => 
        user.id === id ? { ...user, ...updates } : user
      )
    }));
  }
}));