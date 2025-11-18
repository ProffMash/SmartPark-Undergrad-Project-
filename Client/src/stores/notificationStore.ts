import { create } from 'zustand';
import { NotificationState } from '../types';
import { createNotification as apiCreateNotification, markAsRead as apiMarkAsRead, fetchNotifications as apiFetchNotifications } from '../API/notificationApi';
import { useAuthStore } from './authStore';

export const useNotificationStore = create<NotificationState>((set, get) => ({
    deleteNotification: (id: string | number) => {
      set(state => ({
        notifications: state.notifications.filter(n => n.id !== id),
        unreadCount: Math.max(0, state.unreadCount - (state.notifications.find(n => n.id === id && !n.isRead) ? 1 : 0))
      }));
      try {
        if (id != null && !(typeof id === 'string' && id.startsWith('notification-'))) {
          import('../API/notificationApi').then(mod => mod.deleteNotification(id));
        }
      } catch (e) {
        // ignore
      }
    },
  notifications: [],
  unreadCount: 0,

  addNotification: (notificationData) => {
    const newNotification = {
      ...notificationData,
      id: `notification-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    set(state => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));

    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: '/vite.svg',
        tag: newNotification.id
      });
    }
    // Persist to backend when authenticated (best-effort)
    try {
      const auth = useAuthStore.getState();
      const userId = auth.user?.id ?? undefined;
      if (userId) {

        apiCreateNotification({
          user_id: userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data,
          is_read: notificationData.isRead || false
        }).then((serverNotif) => {
          try {
            set(state => {
              const foundById = state.notifications.findIndex(n => n.id === newNotification.id);
              const serverMapped = { id: serverNotif.id, userId: serverNotif.user_id ?? (serverNotif.user && serverNotif.user.id) ?? null, type: serverNotif.type, title: serverNotif.title, message: serverNotif.message, data: serverNotif.data, isRead: Boolean(serverNotif.is_read), createdAt: serverNotif.created_at || serverNotif.createdAt || new Date().toISOString() };
              if (foundById !== -1) {
                // Replace temp id with server id
                const items = state.notifications.map((n, idx) => idx === foundById ? { ...n, id: serverMapped.id, createdAt: serverMapped.createdAt } : n);
                return { notifications: items };
              }
              const fingerprint = (x: any) => `${x.type}::${x.title}::${x.message}::${JSON.stringify(x.data || {})}`;
              const fp = fingerprint(serverMapped);
              const idxByFp = state.notifications.findIndex(n => fingerprint(n) === fp);
              if (idxByFp !== -1) {
                const items = state.notifications.map((n, idx) => idx === idxByFp ? { ...n, id: serverMapped.id, createdAt: serverMapped.createdAt } : n);
                return { notifications: items };
              }
              return { notifications: [serverMapped, ...state.notifications] };
            });
          } catch (e) {
          }
        }).catch(() => {
        });
      }
    } catch (e) {
    }
  },

  markAsRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }));
    try {
      if (id != null) {
        (async () => {
          try {
            await apiMarkAsRead(id as any);
          } catch (e) {
          }
        })();
      }
    } catch (e) {
      // ignore
    }
  },

  markAllAsRead: () => {
    let toPersist: Array<string | number> = [];
    try {
      const existing = get().notifications || [];
      toPersist = existing
        .filter(n => !Boolean(n.isRead))
        .map(n => n.id)
        .filter(id => !(typeof id === 'string' && id.startsWith('notification-')));
    } catch (e) {
      toPersist = [];
    }

    // Optimistically update UI
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0
    }));

    // Persist each server-backed notification as read (best-effort)
    if (toPersist.length > 0) {
      (async () => {
        try {
          await Promise.all(toPersist.map(async (id) => {
            try { await apiMarkAsRead(id as any); } catch (e) { /* ignore per-item failures */ }
          }));
        } catch (e) {
          // ignore
        }
      })();
    }
  },

  clearNotifications: () => {
    // Persist deletion to backend for any server-backed notifications (best-effort)
    try {
      const existing = get().notifications || [];
      const toDelete = existing
        .map(n => n.id)
        .filter(id => !(typeof id === 'string' && id.startsWith('notification-')));

      // Optimistically update UI
      set({ notifications: [], unreadCount: 0 });

      if (toDelete.length > 0) {
        (async () => {
          try {
            await import('../API/notificationApi').then(mod => mod.deleteNotificationsBulk(toDelete));
          } catch (e) {
            // ignore backend deletion failures (UI already cleared)
          }
        })();
      }
      return;
    } catch (e) {
      // fallback: clear locally
    }

    set({ notifications: [], unreadCount: 0 });
  }
  ,
  // Fetch persisted notifications from backend for a user and replace local store
  fetchNotifications: async (userId?: string | number) => {
    try {
      const data = await apiFetchNotifications(userId);
      // normalize the server shape into local Notification shape where possible
      const mapped = (Array.isArray(data) ? data : (data.results || [])).map((n: any) => ({
        id: n.id,
        userId: n.user_id ?? (n.user && n.user.id) ?? null,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        isRead: Boolean(n.is_read),
        createdAt: n.created_at || n.createdAt || new Date().toISOString()
      }));
      // Merge fetched server notifications with any existing local (unsynced) notifications and dedupe
      try {
        const existing = get().notifications || [];
        const fp = (x: any) => `${x.type}::${x.title}::${x.message}::${JSON.stringify(x.data || {})}`;

        // Build fingerprint -> server notification map
        const serverFpSet = new Map<string, any>();
        mapped.forEach((s: any) => {
          serverFpSet.set(fp(s), s);
        });

        const merged: any[] = [...mapped];

        existing.forEach((loc: any) => {
          const locFp = fp(loc);
          if (serverFpSet.has(locFp)) return;
          merged.push(loc);
        });

        set({ notifications: merged, unreadCount: merged.filter((m: any) => !m.isRead).length });
      } catch (e) {
        set({ notifications: mapped, unreadCount: mapped.filter((m: any) => !m.isRead).length });
      }
    } catch (e) {
    }
  }
}));