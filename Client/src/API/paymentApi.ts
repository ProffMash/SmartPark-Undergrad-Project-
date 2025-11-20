import api, { cachedGet, invalidateCacheFor } from './apiClient';

export interface Payment {
  id: number | string;
  bookingId?: number | string;
  userId?: number | string;
  amount: number;
  method?: string; // derived from backend 'payment_method'
  status: 'pending' | 'completed' | 'failed';
  archived?: boolean;
  transactionId?: number | string; // from 'transaction_id'
  createdAt?: string; // from 'created_at'
  paidAt?: string | null; // from 'paid_at'
  slotId?: number | string; // from 'slot_id'
  slotNumber?: string | null; // from 'slot_number'
  userName?: string | null; // from nested user or booking.user
}

// Fetch all payments
export async function fetchPayments(): Promise<Payment[]> {
  const data = await cachedGet<any[]>(`payments/`, undefined, 60);
  return data.map((p) => normalizePayment(p));
}

// Fetch Stripe payments
export async function fetchStripePayments(): Promise<Payment[]> {
  const data = await cachedGet<any[]>(`payments/stripe/`, undefined, 60);
  return data.map((p) => normalizePayment(p));
}

// Create a new payment
export async function createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
  const response = await api.post<any>(`payments/`, payment);
  invalidateCacheFor('payments/', undefined);
  return normalizePayment(response.data);
}

// Update an existing payment
export async function updatePayment(id: number | string, payment: Partial<Omit<Payment, 'id' | 'created_at'>>): Promise<Payment> {
  // Use PATCH for partial updates so backend validation doesn't require all fields
  const response = await api.patch<any>(`payments/${id}/`, payment);
  invalidateCacheFor('payments/', undefined);
  invalidateCacheFor(`payments/${id}/`, undefined);
  return normalizePayment(response.data);
}

// Delete a payment
export async function deletePayment(id: number | string): Promise<void> {
  await api.delete(`payments/${id}/`);
  invalidateCacheFor('payments/', undefined);
  invalidateCacheFor(`payments/${id}/`, undefined);
}

// Fetch a single payment by ID
export async function fetchPaymentById(id: number | string): Promise<Payment> {
  const data = await cachedGet<any>(`payments/${id}/`, undefined, 60);
  return normalizePayment(data);
}

// Create a Stripe Checkout Session (backend will create a local Payment and Stripe session)
export async function createCheckoutSession(payload: { amount: number | string; bookingId: number | string; userId: number | string }) {
  const response = await api.post(`payments/create-checkout-session/`, payload);
  // Response now includes slot_id and slot_number
  // Creating a checkout session may create a Payment on the backend; invalidate payments listing
  invalidateCacheFor('payments/', undefined);
  return response.data; // { url, id, payment_id, slot_id, slot_number }
}

// Verify a Stripe session or a local payment. Accepts either session_id or payment_id in query.
export async function verifySession(params: { session_id?: string; payment_id?: number | string }) {
  const query = new URLSearchParams();
  if (params.session_id) query.set('session_id', params.session_id);
  if (params.payment_id) query.set('payment_id', String(params.payment_id));

  // This is a lightweight verification endpoint; cache briefly to avoid duplicate checks
  return await cachedGet(`payments/verify/`, Object.fromEntries(query.entries()), 10);
}

// Cancel a local payment
export async function cancelPayment(payment_id: number | string) {
  const response = await api.post(`payments/cancel/`, { payment_id });
  // Response now includes slot_id and slot_number
  invalidateCacheFor('payments/', undefined);
  return response.data;
}

// Fetch authenticated user's payment history by userId
export async function fetchPaymentHistory(userId: number | string): Promise<Payment[]> {
  const data = await cachedGet<any[]>(`payments/history/`, { user_id: userId }, 60);
  return data.map((p) => normalizePayment(p));
}

function normalizePayment(p: any): Payment {
  return {
    id: p.id,
    bookingId: p.booking?.id ?? p.booking_id ?? null,
    userId: p.user?.id ?? p.user_id ?? null,
    amount: Number(p.amount) || 0,
    method: p.payment_method ?? p.method ?? (p.stripe_payment_intent || p.stripe_session_id ? 'card (stripe)' : undefined),
    status: (p.status || '').toLowerCase() as 'pending' | 'completed' | 'failed',
    transactionId: p.transaction_id ?? p.transactionId ?? null,
    createdAt: p.created_at ?? p.createdAt ?? null,
    paidAt: p.paid_at ?? p.paidAt ?? null,
    // slot id/number may be at top-level, or nested under booking.slot, or under slot
    slotId: p.slot_id ?? p.slotId ?? p.booking?.slot?.id ?? p.slot?.id ?? null,
    slotNumber: p.slot_number ?? p.slotNumber ?? p.booking?.slot?.slot_number ?? p.slot?.slot_number ?? null,
    userName: p.user?.name ?? p.user?.username ?? p.booking?.user?.name ?? p.booking?.user?.username ?? null,
    archived: Boolean(p.archived),
  } as Payment;
}