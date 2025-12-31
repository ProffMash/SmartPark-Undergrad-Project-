import { create } from 'zustand';
import { AuthState, User } from '../types';
import { loginUser } from '../API/authApi';
import { setAuthToken } from '../API/apiClient';
import { useAppStore } from './appStore';
import { useNotificationStore } from './notificationStore';

// Keys used to persist auth data across page reloads
const AUTH_USER_KEY = 'auth:user';
const AUTH_TOKEN_KEY = 'auth:token';

function loadInitialAuth(): { user: User | null; token: string | null } {
  try {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const user = userStr ? (JSON.parse(userStr) as User) : null;
    if (token) setAuthToken(token);
    return { user, token };
  } catch (err) {
    return { user: null, token: null };
  }
}

const initialAuth = typeof window !== 'undefined' ? loadInitialAuth() : { user: null, token: null };

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialAuth.user,
  isAuthenticated: !!initialAuth.token && !!initialAuth.user,
  token: initialAuth.token ?? null,

  login: async (email: string, password: string): Promise<boolean> => {
    try {
      const resp = await loginUser({ email, password });
      if (resp && resp.token) {
        // Map API user shape to local User type
        const apiUser: User = {
          id: resp.id,
          name: resp.name,
          email: resp.email,
          phone: resp.phone || '',
          vehicleNumber: resp.vehicle_number || '',
          vehicleModel: resp.vehicle_model || undefined,
          vehicleType: (resp as any).vehicle_type || '',
          role: (resp.role as 'user' | 'admin' | 'operator') || 'user',
          isActive: resp.is_active,
          createdAt: resp.created_at,
        };

  set({ user: apiUser, isAuthenticated: true, token: resp.token });
  try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(apiUser)); } catch {};
  try { localStorage.setItem(AUTH_TOKEN_KEY, resp.token); } catch {};
  setAuthToken(resp.token);

        // After successful login, load server data into the app store so
        // data is shared across devices (server-side persistence).
        // We call the app store's loadFromServer if available.
        const appStore = useAppStore.getState();
        if (typeof appStore.loadFromServer === 'function') {
          // don't await here to avoid blocking login UI, but handle errors inside
          appStore.loadFromServer().catch(() => {
            /* swallow sync errors for now; UI may trigger retry */
          });
        }

        // Fetch persisted notifications for the logged-in user (best-effort)
        try {
          const notifStore = useNotificationStore.getState();
          if (typeof notifStore.fetchNotifications === 'function') {
            notifStore.fetchNotifications(apiUser.id).catch(() => {});
          }
        } catch (e) {
          // ignore errors during notification fetch
        }

        return true;
      }
    } catch (err) {
      // API login failed - return false so caller can show an error
    }

    return false;
  },

  logout: () => {
  set({ user: null, isAuthenticated: false, token: null });
  try { localStorage.removeItem(AUTH_USER_KEY); } catch {};
  try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch {};
  setAuthToken(null);
  // Clear local notifications on logout
  try {
    const notifStore = useNotificationStore.getState();
    if (typeof notifStore.clearNotifications === 'function') notifStore.clearNotifications();
  } catch (e) {}
  },

  updateUser: (updates: Partial<User>) => {
  const current = get().user;
  if (!current) return;
  const updatedUser = { ...current, ...updates };
  set({ user: updatedUser });
  try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser)); } catch {};
  }
}));

// If we have an initial auth loaded, trigger app data sync in background.
if (initialAuth.token && initialAuth.user) {
  const appStore = useAppStore.getState();
  if (typeof appStore.loadFromServer === 'function') {
    appStore.loadFromServer().catch(() => {
      /* swallow background sync errors */
    });
  }
  // Also fetch persisted notifications on page refresh when we already have auth
  try {
    const notifStore = useNotificationStore.getState();
    if (typeof notifStore.fetchNotifications === 'function') {
      // don't await to avoid blocking boot, handle errors inside
      // use initialAuth.user.id which is already available synchronously
      notifStore.fetchNotifications((initialAuth.user as any).id).catch(() => {});
    }
  } catch (e) {
    // ignore
  }
}