import api from './apiClient';

export interface RegisterPayload {
  email: string;
  username?: string;
  password: string;
  name?: string;
  role?: string;
  phone?: string;
  vehicle_number?: string;
  vehicle_model?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  id: number;
  email: string;
  username: string;
  role: string;
  name: string;
  phone: string;
  vehicle_number: string;
  vehicle_model?: string | null;
  is_active: boolean;
  created_at: string;
  message: string;
  token: string;
}

export async function registerUser(payload: RegisterPayload): Promise<{ message: string; token: string } | any> {
  const response = await api.post(`auth/register/`, payload);
  return response.data;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(`auth/login/`, payload);
  return response.data;
}

export default {
  registerUser,
  loginUser,
};
