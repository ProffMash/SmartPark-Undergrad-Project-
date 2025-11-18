
import api from './apiClient';

export interface ApiUser {
	id: number | string;
	email: string;
	username?: string | null;
	role?: string | null;
	name?: string | null;
	phone?: string | null;
	vehicle_number?: string | null;
	vehicle_model?: string | null;
	is_active?: boolean;
	created_at?: string | null;
}

export interface CreateUserPayload {
	email: string;
	password: string;
	username?: string;
	name?: string;
	role?: string;
	phone?: string;
	vehicle_number?: string;
	vehicle_model?: string;
}

// Fetch all users
export async function fetchUsers(): Promise<ApiUser[]> {
	const response = await api.get<ApiUser[]>(`users/`);
	return response.data;
}

// Create a new user (registration / admin create)
export async function createUser(payload: CreateUserPayload): Promise<ApiUser> {
	const response = await api.post<ApiUser>(`users/`, payload);
	return response.data;
}

// Update an existing user (partial updates allowed)
export async function updateUser(id: number | string, updates: Partial<CreateUserPayload & ApiUser>): Promise<ApiUser> {
	const response = await api.patch<ApiUser>(`users/${id}/`, updates);
	return response.data;
}

// Replace a user (full update)
export async function replaceUser(id: number | string, user: CreateUserPayload): Promise<ApiUser> {
	const response = await api.put<ApiUser>(`users/${id}/`, user);
	return response.data;
}

// Delete a user

// Delete a user by ID
export async function deleteUser(id: number | string): Promise<void> {
	await api.delete(`users/${id}/`);
}

// Delete current user's account (self-service)
import { useAuthStore } from '../stores/authStore';
export async function deleteAccount(): Promise<void> {
	const { user } = useAuthStore.getState();
	if (!user || !user.id) throw new Error('No user ID found');
	await api.delete(`users/${user.id}/`);
}

// Fetch a single user by ID
export async function fetchUserById(id: number | string): Promise<ApiUser> {
	const response = await api.get<ApiUser>(`users/${id}/`);
	return response.data;
}

export default {
	fetchUsers,
	createUser,
	updateUser,
	replaceUser,
	deleteUser,
	fetchUserById,
};
