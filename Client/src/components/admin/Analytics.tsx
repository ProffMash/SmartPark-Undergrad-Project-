import React, { useEffect, useState } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
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
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

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
  // Only include payments with a real transactionId (not session id)
  const realPayments = payments.filter((p: any) => p.transactionId && typeof p.transactionId === 'string' && !p.transactionId.startsWith('cs_'));
  const totalRevenue = realPayments
    .filter((payment: any) => payment.status === 'completed')
    .reduce((sum: number, payment: any) => sum + (Number(payment.amount) || 0), 0);
  // Format revenue for display with 2 decimal places
  const formattedTotalRevenue = Number(totalRevenue || 0).toFixed(2);
  // Completed / pending breakdown and averages (formatted)
  const completedRevenue = realPayments
    .filter((p: any) => p.status === 'completed')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const pendingRevenue = realPayments
    .filter((p: any) => p.status === 'pending')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const formattedCompletedRevenue = Number(completedRevenue || 0).toFixed(2);
  const formattedPendingRevenue = Number(pendingRevenue || 0).toFixed(2);
  const completedCount = realPayments.filter((p: any) => p.status === 'completed').length;

  // Revenue-based slices (use completed + pending revenue )
  const totalRevenueForChart = (completedRevenue + pendingRevenue) || 1;
  const completedPercent = totalRevenueForChart > 0 ? ((completedRevenue / totalRevenueForChart) * 100).toFixed(1) : '0.0';
  const pendingPercent = totalRevenueForChart > 0 ? ((pendingRevenue / totalRevenueForChart) * 100).toFixed(1) : '0.0';
  const averageTransaction = completedCount > 0 ? Number(completedRevenue / completedCount).toFixed(2) : '0.00';
  
  const activeBookings = bookings.filter((booking: any) => booking.status === 'active').length;
  const openTickets = tickets.filter((ticket: any) => ticket.status === 'open').length;

  const occupancyRate = totalSlots > 0 ? (bookedSlots / totalSlots * 100).toFixed(1) : '0';

    // Use Recharts for the slot bar chart (rendered below)

  const stats = [
    {
      name: 'Total Users',
      value: totalUsers.toString(),
      icon: Users,
      color: 'bg-blue-600',
  bgColor: 'bg-blue-100',
  cardBg: 'bg-blue-100'
    },
    {
      name: 'Total Slots',
      value: totalSlots.toString(),
      icon: MapPin,
      color: 'bg-violet-600',
  bgColor: 'bg-violet-100',
  cardBg: 'bg-violet-100'
    },
    {
      name: 'Occupancy Rate',
      value: `${occupancyRate}%`,
      icon: TrendingUp,
      color: 'bg-green-600',
  bgColor: 'bg-green-100',
  cardBg: 'bg-green-100'
    },
    {
      name: 'Total Revenue',
      value: `KSh ${formattedTotalRevenue}`,
      icon: DollarSign,
      color: 'bg-amber-600',
  bgColor: 'bg-amber-100',
  cardBg: 'bg-amber-100'
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
          {loading && (
            <div className="flex items-center justify-center min-h-[200px] mt-2">
              <FadeLoader color="#2563EB" />
            </div>
          )}
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon as any;
            return (
              <div key={index} className={`rounded-xl shadow-lg p-4 sm:p-6 ${stat.cardBg || 'bg-white'}`}>
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
                <span className="text-lg font-bold text-green-600">KSh {formattedCompletedRevenue}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Pending Payments</span>
                <span className="text-lg font-bold text-yellow-600">KSh {formattedPendingRevenue}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Transaction</span>
                <span className="text-lg font-bold text-blue-600">KSh {averageTransaction}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Trends (payments + slots) */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Data Trends</h3>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Payments Breakdown</h4>
              </div>
              <div style={{ width: 160, height: 160, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ name: 'Completed', value: completedRevenue }, { name: 'Pending', value: pendingRevenue }]} dataKey="value" innerRadius={40} outerRadius={60} startAngle={90} endAngle={-270}>
                      <Cell key="c" fill="#16a34a" />
                      <Cell key="p" fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(val: number) => [`KSh ${Number(val).toFixed(2)}`, 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex-1">
              <ul className="space-y-3">
                <li className="flex items-center justify-start">
                  <div className="flex items-center space-x-3">
                    <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
                    <span className="text-gray-700">Completed</span>
                    <span className="text-sm text-gray-500">({completedPercent}%)</span>
                    <div className="font-semibold text-green-600 ml-3">KSh {formattedCompletedRevenue}</div>
                  </div>
                </li>

                <li className="flex items-center justify-start">
                  <div className="flex items-center space-x-3">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
                    <span className="text-gray-700">Pending</span>
                    <span className="text-sm text-gray-500">({pendingPercent}%)</span>
                    <div className="font-semibold text-yellow-600 ml-3">KSh {formattedPendingRevenue}</div>
                  </div>
                </li>

              </ul>
            </div>
            {/* Booked vs Free slots (Recharts) */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="text-center mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Booked vs Free Slots</h4>
              </div>
              <div style={{ width: 240, height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart layout="vertical" data={[{ name: 'Free', value: freeSlots }, { name: 'Booked', value: bookedSlots }]} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={60} />
                    <Tooltip formatter={(val: number) => [val, 'Slots']} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 6, 6]} />
                  </ReBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};