import api from './apiClient';

export interface ParkingSlot {
  id: number;
  slot_number: string;
  location: string;
  coordinates_lat: number;
  coordinates_lng: number;
  is_booked: boolean;
  price: number;
  type: 'regular' | 'premium' | 'vip';
  facilities: string[];
  created_at: string;
}

// Fetch all parking slots
export async function fetchParkingSlots(): Promise<ParkingSlot[]> {
  const response = await api.get<ParkingSlot[]>(`slots/`);
  return response.data;
}

// Create a new parking slot
export async function createParkingSlot(slot: Omit<ParkingSlot, 'id' | 'created_at'>): Promise<ParkingSlot> {
  const response = await api.post<ParkingSlot>(`slots/`, slot);
  return response.data;
}

// Update an existing parking slot
// Use PATCH so callers may send partial updates (e.g. { is_booked: true }) without needing the full resource payload.
export async function updateParkingSlot(id: number, slot: Partial<Omit<ParkingSlot, 'id' | 'created_at'>>): Promise<ParkingSlot> {
  const response = await api.patch<ParkingSlot>(`slots/${id}/`, slot);
  return response.data;
}

// Delete a parking slot
export async function deleteParkingSlot(id: number): Promise<void> {
  await api.delete(`slots/${id}/`);
}

// Fetch a single parking slot by ID
export async function fetchParkingSlotById(id: number): Promise<ParkingSlot> {
  const response = await api.get<ParkingSlot>(`slots/${id}/`);
  return response.data;
}
