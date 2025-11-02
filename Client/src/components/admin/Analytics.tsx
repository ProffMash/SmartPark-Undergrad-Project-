import React, { useEffect, useState } from 'react';
import { 
  Users, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { fetchUsers } from '../../API/usersApi';
import { fetchParkingSlots } from '../../API/parkingSlotApi';
import { fetchBookings } from '../../API/bookingApi';
import { fetchPayments } from '../../API/paymentApi';
import { fetchTickets } from '../../API/ticketApi';

export const Analytics: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [u, s, b, p, t] = await Promise.all([
          fetchUsers(),
          fetchParkingSlots(),
          fetchBookings(),
          fetchPayments(),
          fetchTickets(),
        ]);
        if (!mounted) return;
        setUsers(u || []);
        setSlots(s || []);
        setBookings(b || []);
        setPayments(p || []);
        setTickets(t || []);
      } catch (err) {
        // keep empty arrays on error
      }
      if (mounted) setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const totalUsers = users.filter(user => user.role === 'user').length;
  const totalSlots = slots.length;
  const bookedSlots = slots.filter((slot: any) => slot.is_booked || slot.isBooked).length;
  const freeSlots = totalSlots - bookedSlots;
  const totalRevenue = payments
    .filter((payment: any) => payment.status === 'completed')
    .reduce((sum: number, payment: any) => sum + (Number(payment.amount) || 0), 0);
  // Format revenue for display with 3 decimal places
  const formattedTotalRevenue = Number(totalRevenue || 0).toFixed(3);
  // Completed / pending breakdown and averages (formatted)
  const completedRevenue = payments
    .filter((p: any) => p.status === 'completed')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const pendingRevenue = payments
    .filter((p: any) => p.status === 'pending')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const formattedCompletedRevenue = Number(completedRevenue || 0).toFixed(3);
  const formattedPendingRevenue = Number(pendingRevenue || 0).toFixed(3);
  const completedCount = payments.filter((p: any) => p.status === 'completed').length;
  const averageTransaction = completedCount > 0 ? Number(completedRevenue / completedCount).toFixed(3) : '0.000';
  
  const activeBookings = bookings.filter((booking: any) => booking.status === 'active').length;
  const openTickets = tickets.filter((ticket: any) => ticket.status === 'open').length;

  const occupancyRate = totalSlots > 0 ? (bookedSlots / totalSlots * 100).toFixed(1) : '0';

  const stats = [
    {
      name: 'Total Users',
      value: totalUsers.toString(),
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Total Slots',
      value: totalSlots.toString(),
      icon: MapPin,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50'
    },
    {
      name: 'Occupancy Rate',
      value: `${occupancyRate}%`,
      icon: TrendingUp,
      color: 'bg-green-500',
      bgColor: 'bg-green-50'
    },
    {
      name: 'Total Revenue',
      value: `$${formattedTotalRevenue}`,
      icon: DollarSign,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50'
    }
  ];

  const quickStats = [
    { label: 'Free Slots', value: freeSlots, color: 'text-green-600' },
    { label: 'Booked Slots', value: bookedSlots, color: 'text-red-600' },
    { label: 'Active Bookings', value: activeBookings, color: 'text-blue-600' },
    { label: 'Open Tickets', value: openTickets, color: 'text-orange-600' }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">Overview of your parking system performance</p>
          {loading && <p className="text-sm text-gray-500 mt-2">Loading data...</p>}
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon as any;
            return (
              <div key={index} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-6 w-6 ${stat.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Stats</h3>
            <div className="space-y-4">
              {quickStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-gray-600">{stat.label}</span>
                  <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">System Status</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">System Online</p>
                  <p className="text-sm text-gray-600">All services running</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900">Payment Gateway</p>
                  <p className="text-sm text-gray-600">Processing normally</p>
                </div>
              </div>
              
              {openTickets > 0 && (
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-gray-900">{openTickets} Open Tickets</p>
                    <p className="text-sm text-gray-600">Require attention</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Breakdown</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completed Payments</span>
                <span className="text-lg font-bold text-green-600">${formattedCompletedRevenue}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Pending Payments</span>
                <span className="text-lg font-bold text-yellow-600">${formattedPendingRevenue}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Transaction</span>
                <span className="text-lg font-bold text-blue-600">${averageTransaction}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};