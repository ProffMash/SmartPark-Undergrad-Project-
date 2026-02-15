import api, { cachedGet, invalidateCacheFor } from './apiClient';

export interface Ticket {
  id: number | string;
  user_id: number | string;
  message: string;
  status: string;
  priority: string;
  response?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: number | string;
  ticket: number | string;
  sender: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    avatar?: string | null;
  };
  message: string;
  is_read: boolean;
  created_at: string;
}

// Fetch all tickets
export async function fetchTickets(): Promise<Ticket[]> {
  return await cachedGet<Ticket[]>(`tickets/`, undefined, 60);
}

// Create a new ticket
export async function createTicket(ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Promise<Ticket> {
  const response = await api.post<Ticket>(`tickets/`, ticket);
  invalidateCacheFor('tickets/', undefined);
  return response.data;
}

// Update an existing ticket
export async function updateTicket(id: number | string, ticket: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at'>>): Promise<Ticket> {
  // Use PATCH to allow partial updates; the TicketSerializer requires user_id on full PUT
  const response = await api.patch<Ticket>(`tickets/${id}/`, ticket);
  invalidateCacheFor('tickets/', undefined);
  invalidateCacheFor(`tickets/${id}/`, undefined);
  return response.data;
}

// Delete a ticket
export async function deleteTicket(id: number | string): Promise<void> {
  await api.delete(`tickets/${id}/`);
  invalidateCacheFor('tickets/', undefined);
  invalidateCacheFor(`tickets/${id}/`, undefined);
}

// Fetch a single ticket by ID
export async function fetchTicketById(id: number | string): Promise<Ticket> {
  return await cachedGet<Ticket>(`tickets/${id}/`, undefined, 60);
}

// Fetch messages for a ticket
export async function fetchTicketMessages(ticketId: number | string): Promise<TicketMessage[]> {
  const response = await api.get<TicketMessage[]>(`tickets/${ticketId}/messages/`);
  return response.data;
}

// Send a message to a ticket
export async function sendTicketMessage(ticketId: number | string, senderId: number | string, message: string): Promise<TicketMessage> {
  const response = await api.post<TicketMessage>(`tickets/${ticketId}/messages/`, {
    sender_id: senderId,
    message: message,
  });
  return response.data;
}

// Mark messages as read for a ticket
export async function markMessagesAsRead(ticketId: number | string, readerId: number | string, readerRole: string): Promise<void> {
  await api.post(`tickets/${ticketId}/mark-read/`, {
    reader_id: readerId,
    reader_role: readerRole,
  });
}
