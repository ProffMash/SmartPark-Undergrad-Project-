import api from './apiClient';

export interface Ticket {
  id: number | string;
  user_id: number | string;
  subject: string;
  message: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  response?: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all tickets
export async function fetchTickets(): Promise<Ticket[]> {
  const response = await api.get<Ticket[]>(`tickets/`);
  return response.data;
}

// Create a new ticket
export async function createTicket(ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at'>): Promise<Ticket> {
  const response = await api.post<Ticket>(`tickets/`, ticket);
  return response.data;
}

// Update an existing ticket
export async function updateTicket(id: number | string, ticket: Partial<Omit<Ticket, 'id' | 'created_at' | 'updated_at'>>): Promise<Ticket> {
  // Use PATCH to allow partial updates; the TicketSerializer requires user_id on full PUT
  const response = await api.patch<Ticket>(`tickets/${id}/`, ticket);
  return response.data;
}

// Delete a ticket
export async function deleteTicket(id: number | string): Promise<void> {
  await api.delete(`tickets/${id}/`);
}

// Fetch a single ticket by ID
export async function fetchTicketById(id: number | string): Promise<Ticket> {
  const response = await api.get<Ticket>(`tickets/${id}/`);
  return response.data;
}
