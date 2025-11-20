import api, { cachedGet, invalidateCacheFor } from './apiClient';

export interface Contact {
  id: number | string;
  name: string;
  email: string;
  message: string;
  created_at: string;
}

// Fetch all contacts
export async function fetchContacts(): Promise<Contact[]> {
  return await cachedGet<Contact[]>(`contacts/`, undefined, 60);
}

// Create a new contact
export async function createContact(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
  const response = await api.post<Contact>(`contacts/`, contact);
  invalidateCacheFor('contacts/', undefined);
  return response.data;
}

// Update an existing contact
export async function updateContact(id: number | string, contact: Partial<Omit<Contact, 'id' | 'created_at'>>): Promise<Contact> {
  const response = await api.put<Contact>(`contacts/${id}/`, contact);
  invalidateCacheFor('contacts/', undefined);
  invalidateCacheFor(`contacts/${id}/`, undefined);
  return response.data;
}

// Delete a contact
export async function deleteContact(id: number | string): Promise<void> {
  await api.delete(`contacts/${id}/`);
  invalidateCacheFor('contacts/', undefined);
  invalidateCacheFor(`contacts/${id}/`, undefined);
}

// Fetch a single contact by ID
export async function fetchContactById(id: number | string): Promise<Contact> {
  return await cachedGet<Contact>(`contacts/${id}/`, undefined, 60);
}
