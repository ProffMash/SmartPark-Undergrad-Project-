import api, { cachedGet, invalidateCacheFor } from './apiClient';

export interface Booking {
  id: number;
  user_id: number | string;
  archived?: boolean;
  slot_id: number | string;
  start_time?: string | null;
  end_time?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  amount: number | string;
  payment_id?: number | string | null;
  transaction_id?: string | null;
  created_at: string;
  username?: string;
  user_id_read?: number | string;
  user?: {
    id: number | string;
    username: string;
    [key: string]: any;
  };
}

// Fetch all bookings
export async function fetchBookings(): Promise<Booking[]> {
  const data = await cachedGet<Booking[]>(`bookings/`, undefined, 60);
  // Normalize all bookings to app shape
  return data.map((b: any) => {
    let username = b.username;
    let user_id_read = b.user_id_read;
    if (!username && b.user && b.user.username) {
      username = b.user.username;
    }
    if (!user_id_read && b.user && b.user.id) {
      user_id_read = b.user.id;
    }
    return {
      ...b,
      userId: b.userId ?? b.user_id ?? b.user_id_read ?? user_id_read,
      slotId: b.slotId ?? b.slot_id,
      startTime: b.startTime ?? b.start_time,
      endTime: b.endTime ?? b.end_time,
      paymentId: b.paymentId ?? b.payment_id,
      createdAt: b.createdAt ?? b.created_at,
      username,
      user_id_read,
    };
  });
}

// Create a new booking
export async function createBooking(booking: Omit<Booking, 'id' | 'created_at'>): Promise<Booking> {
  const response = await api.post<Booking>(`bookings/`, booking);
  // New booking changes list of bookings, invalidate cache
  invalidateCacheFor('bookings/', undefined);
  return response.data;
}

// Update an existing booking
export async function updateBooking(id: number | string, booking: Partial<Omit<Booking, 'id' | 'created_at'>>): Promise<Booking> {
  const response = await api.put<Booking>(`bookings/${id}/`, booking);
  invalidateCacheFor('bookings/', undefined);
  invalidateCacheFor(`bookings/${id}/`, undefined);
  return response.data;
}

// Delete a booking
export async function deleteBooking(id: number | string): Promise<void> {
  await api.delete(`bookings/${id}/`);
  invalidateCacheFor('bookings/', undefined);
  invalidateCacheFor(`bookings/${id}/`, undefined);
}

// Fetch a single booking by ID
export async function fetchBookingById(id: number | string): Promise<Booking> {
  const b = await cachedGet<Booking>(`bookings/${id}/`, undefined, 60);
  let username = b.username;
  let user_id_read = b.user_id_read;
  if (!username && b.user && b.user.username) {
    username = b.user.username;
  }
  if (!user_id_read && b.user && b.user.id) {
    user_id_read = b.user.id;
  }
  return {
    ...b,
    username,
    user_id_read,
  };
}

// Fetch authenticated user's booking history by userId
export async function fetchBookingHistory(userId: number | string): Promise<Booking[]> {
  const data = await cachedGet<Booking[]>(`bookings/history/`, { user_id: userId }, 60);
  return data;
}
