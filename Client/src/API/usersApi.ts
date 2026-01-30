
import api, { cachedGet, invalidateCacheFor } from './apiClient';

export interface ApiUser {
	id: number | string;
	email: string;
	username?: string | null;
	role?: string | null;
	name?: string | null;
	phone?: string | null;
	avatar?: string | null;
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
	avatar?: string | File | null;
}

// Fetch all users
export async function fetchUsers(): Promise<ApiUser[]> {
	return await cachedGet<ApiUser[]>(`users/`, undefined, 120);
}

// Create a new user (registration / admin create)
export async function createUser(payload: CreateUserPayload): Promise<ApiUser> {
	const response = await api.post<ApiUser>(`users/`, payload);
	invalidateCacheFor('users/', undefined);
	return response.data;
}

// Update an existing user (partial updates allowed)
export async function updateUser(id: number | string, updates: Partial<CreateUserPayload & ApiUser> | FormData): Promise<ApiUser> {
	// If caller provided a FormData (for file upload) send it directly
	if (updates instanceof FormData) {
		// When sending FormData we must override the default JSON content-type
		// so the browser can set the proper multipart boundary.
		const response = await api.patch<ApiUser>(`users/${id}/`, updates, {
			headers: { 'Content-Type': 'multipart/form-data' },
		});
		return response.data;
	}

	// If updates contain a File under `avatar` key, convert to FormData
	if ((updates as any)?.avatar instanceof File) {
		const fd = new FormData();
		for (const key of Object.keys(updates)) {
			const val = (updates as any)[key];
			if (val === undefined || val === null) continue;
			if (key === 'avatar') {
				fd.append('avatar', val as File);
			} else {
				fd.append(key, String(val));
			}
		}
				const response = await api.patch<ApiUser>(`users/${id}/`, fd, {
					headers: { 'Content-Type': 'multipart/form-data' },
				});
		return response.data;
	}

	const response = await api.patch<ApiUser>(`users/${id}/`, updates as any);
	invalidateCacheFor('users/', undefined);
	invalidateCacheFor(`users/${id}/`, undefined);
	return response.data;
}

// Replace a user (full update)
export async function replaceUser(id: number | string, user: CreateUserPayload): Promise<ApiUser> {
	const response = await api.put<ApiUser>(`users/${id}/`, user);
	invalidateCacheFor('users/', undefined);
	invalidateCacheFor(`users/${id}/`, undefined);
	return response.data;
}

// Delete a user

// Delete a user by ID
export async function deleteUser(id: number | string): Promise<void> {
	await api.delete(`users/${id}/`);
	invalidateCacheFor('users/', undefined);
	invalidateCacheFor(`users/${id}/`, undefined);
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
	return await cachedGet<ApiUser>(`users/${id}/`, undefined, 120);
}

// Start an impersonation session for the given user ID.
// Backend should validate the requesting admin and return a short-lived
// token + minimal user info for the impersonated session.
export async function impersonate(id: number | string): Promise<{ token?: string; user?: ApiUser; redirectUrl?: string }>{
	// Note: endpoint path follows DRF-style patterns in this project
	const response = await api.post<{ token?: string; user?: ApiUser; redirectUrl?: string }>(`users/${id}/impersonate/`);
	return response.data;
}

export default {
	fetchUsers,
	createUser,
	updateUser,
	replaceUser,
	deleteUser,
	fetchUserById,
    impersonate,
};
