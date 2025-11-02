export interface User {
  id: number | string;
  name: string;
  email: string;
  phone: string;
  vehicleNumber: string;
  vehicleModel?: string;
  vehicleType: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: string;
}

export interface ParkingSlot {
  id: number | string;
  number: string;
  location: string;
  // Use a coordinates tuple in the app for convenience
  coordinates?: [number, number];
  // Keep lat/lng for compatibility with API shapes
  coordinates_lat?: number;
  coordinates_lng?: number;
  isBooked: boolean;
  price: number;
  type: 'regular' | 'premium' | 'vip';
  facilities: string[];
  createdAt: string;
}

export interface Booking {
  id: number;
  userId: number | string;
  slotId: number | string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  amount: number;
  paymentId?: number | string;
  createdAt: string;
}

export interface Payment {
  id: number | string;
  bookingId: number | string;
  userId: number | string;
  amount: number;
  // optional method field (e.g. 'card', 'cash') exists in mock data
  method?: string;
  status: 'pending' | 'completed' | 'failed';
  transactionId: number | string;
  createdAt: string;
}

export interface Ticket {
  id: number | string;
  userId: number | string;
  subject: string;
  message: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  response?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: number | string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  // status tracked in UI: new, contacted, resolved
  status?: 'new' | 'contacted' | 'resolved';
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  // Persisted auth token (if any)
  token?: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export interface AppState {
  users: User[];
  slots: ParkingSlot[];
  bookings: Booking[];
  payments: Payment[];
  tickets: Ticket[];
  contacts: Contact[];
  // Optional: function to load latest data from server (implemented in store)
  loadFromServer?: () => Promise<void>;
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => void;
  addSlot: (slot: Omit<ParkingSlot, 'id' | 'createdAt'>) => void;
  // Replace the entire slots array (useful when syncing from server)
  setSlots: (slots: ParkingSlot[]) => void;
  // Replace the entire users array (useful when syncing from server)
  setUsers: (users: User[]) => void;
  // Insert or update a single slot preserving its id
  upsertSlot: (slot: ParkingSlot) => void;
  updateSlot: (id: number | string, updates: Partial<ParkingSlot>) => void;
  deleteSlot: (id: number | string) => void;
  // allow callers to pass a booking object that may already contain an id (created before payment)
  addBooking: (booking: Omit<Booking, 'createdAt'> | Omit<Booking, 'id' | 'createdAt'>) => void;
  updateBooking: (id: number | string, updates: Partial<Booking>) => void;
  // allow callers to pass a payment object that may already contain an id (simulated/local payments)
  addPayment: (payment: Omit<Payment, 'createdAt'> | Omit<Payment, 'id' | 'createdAt'>) => void;
  addTicket: (ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTicket: (id: number | string, updates: Partial<Ticket>) => void;
  addContact: (contact: Omit<Contact, 'id' | 'createdAt'>) => void;
  updateContact: (id: number | string, updates: Partial<Contact>) => void;
  updateUser: (id: number | string, updates: Partial<User>) => void;
}

export interface Notification {
  id: number | string;
  userId: number | string;
  type: 'booking_confirmation' | 'booking_reminder' | 'payment_receipt';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  markAsRead: (id: number | string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}