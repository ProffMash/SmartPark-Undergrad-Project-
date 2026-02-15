import { User, ParkingSlot, Booking, Payment, Ticket, Contact } from '../types';

export const mockUsers: User[] = [
  {
  id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    vehicleNumber: 'ABC-123',
    vehicleType: 'sedan',
    role: 'user',
    isActive: true,
    createdAt: '2024-01-15T10:00:00Z'
  },
  {
    id: 2,
    name: 'Admin User',
    email: 'admin@smartpark.com',
    phone: '+1987654321',
    vehicleNumber: 'ADMIN-001',
    vehicleType: 'suv',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-01T08:00:00Z'
  }
];

export const mockSlots: ParkingSlot[] = [
  {
  id: 1,
    number: 'A-001',
    location: 'Sarit Centre, Westlands',
    coordinates: [-1.2648, 36.8005], // Nairobi
    isBooked: false,
    price: 150,
    type: 'regular',
    facilities: ['Security Camera', 'Lighting'],
    createdAt: '2024-01-10T09:00:00Z'
  },
  {
  id: 2,
    number: 'A-002',
    location: 'Sarit Centre, Westlands',
    coordinates: [-1.2649, 36.8007], // Nairobi
    isBooked: true,
    price: 150,
    type: 'regular',
    facilities: ['Security Camera', 'Lighting'],
    createdAt: '2024-01-10T09:00:00Z'
  },
  {
  id: 3,
    number: 'B-001',
    location: 'Kenyatta Avenue, CBD',
    coordinates: [-1.2864, 36.8172], // Nairobi CBD
    isBooked: false,
    price: 200,
    type: 'premium',
    facilities: ['Security Camera', 'Lighting', 'EV Charging', 'Valet Service'],
    createdAt: '2024-01-10T09:00:00Z'
  },
  {
  id: 4,
    number: 'C-001',
    location: 'Jomo Kenyatta Int. Airport',
    coordinates: [-1.3192, 36.9278], // JKIA
    isBooked: false,
    price: 300,
    type: 'premium',
    facilities: ['Security Camera', 'Lighting', 'Shuttle Service'],
    createdAt: '2024-01-10T09:00:00Z'
  },
  {
  id: 5,
    number: 'D-001',
    location: 'Yaya Centre, Kilimani',
    coordinates: [-1.3001, 36.7896], // Nairobi
    isBooked: false,
    price: 120,
    type: 'disabled',
    facilities: ['Security Camera', 'Lighting', 'Wheelchair Access'],
    createdAt: '2024-01-10T09:00:00Z'
  },
  {
  id: 6,
  number: 'E-001',
  location: 'Two Rivers Mall, Ruaka',
  coordinates: [-1.2108, 36.8089], // Two Rivers
  isBooked: false,
  price: 250,
  type: 'premium',
  facilities: ['Security Camera', 'Lighting', 'EV Charging'],
  createdAt: '2024-01-11T09:00:00Z'
},
{
  id: 7,
  number: 'F-001',
  location: 'Village Market, Gigiri',
  coordinates: [-1.2345, 36.8175],
  isBooked: false,
  price: 180,
  type: 'regular',
  facilities: ['Security Camera', 'Lighting'],
  createdAt: '2024-01-11T09:00:00Z'
}

];


export const mockBookings: Booking[] = [
  {
  id: 1,
  userId: 1,
  slotId: 2,
    startTime: '2024-01-20T10:00:00Z',
    endTime: '2024-01-20T14:00:00Z',
    status: 'active',
    amount: 40,
  paymentId: 1,
    createdAt: '2024-01-20T09:30:00Z'
  }
];

export const mockPayments: Payment[] = [
  {
  id: 1,
  bookingId: 1,
  userId: 1,
    amount: 40,
    method: 'card',
    status: 'completed',
  transactionId: 1234567890,
    createdAt: '2024-01-20T09:35:00Z'
  }
];

export const mockTickets: Ticket[] = [
  {
  id: 1,
  userId: 1,
    message: 'The slot A-002 was showing as available but when I arrived it was occupied.',
    status: 'open',
    priority: 'medium',
    createdAt: '2024-01-19T14:30:00Z',
    updatedAt: '2024-01-19T14:30:00Z'
  }
];

export const mockContacts: Contact[] = [
  {
  id: 1,
    name: 'Sarah Wilson',
    email: 'sarah@example.com',
    message: 'I would like to know more about your premium parking slots and their facilities.',
    status: 'new',
    createdAt: '2024-01-18T16:20:00Z'
  }
];