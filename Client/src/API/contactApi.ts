import api from './apiClient';

export interface Contact {
  id: number | string;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

// Fetch all contacts
export async function fetchContacts(): Promise<Contact[]> {
  const response = await api.get<Contact[]>(`contacts/`);
  return response.data;
}

// Create a new contact
export async function createContact(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
  const response = await api.post<Contact>(`contacts/`, contact);
  return response.data;
}

// Update an existing contact
export async function updateContact(id: number | string, contact: Partial<Omit<Contact, 'id' | 'created_at'>>): Promise<Contact> {
  const response = await api.put<Contact>(`contacts/${id}/`, contact);
  return response.data;
}

// Delete a contact
export async function deleteContact(id: number | string): Promise<void> {
  await api.delete(`contacts/${id}/`);
}

// Fetch a single contact by ID
export async function fetchContactById(id: number | string): Promise<Contact> {
  const response = await api.get<Contact>(`contacts/${id}/`);
  return response.data;
}
