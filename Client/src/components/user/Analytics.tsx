import React, { useEffect, useState } from 'react';
import { BarChart2, CreditCard, Calendar, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { fetchBookingHistory } from '../../API/bookingApi';
import { fetchPaymentHistory } from '../../API/paymentApi';

export const Analytics: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [totalBookings, setTotalBookings] = useState(0);
  const [activeBookings, setActiveBookings] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [averageDurationMinutes, setAverageDurationMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) {
      // No authenticated user: clear any previous values and stop loading
      setTotalBookings(0);
      setActiveBookings(0);
      setTotalSpent(0);
      setAverageDurationMinutes(null);
      setLoading(false);
      return;
    }

    const uid = user.id;

    async function load() {
      setLoading(true);
      try {
        const [bookings, payments] = await Promise.all([
          fetchBookingHistory(uid),
          fetchPaymentHistory(uid),
        ]);

        setTotalBookings(bookings.length);
        setActiveBookings(bookings.filter((b: any) => b.status === 'active').length);

  const spent = payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  setTotalSpent(spent || 0);

        // Compute average booking duration in minutes when start_time/end_time available
        const durations: number[] = bookings
          .map((b: any) => {
            const s = b.start_time ? new Date(b.start_time) : null;
            const e = b.end_time ? new Date(b.end_time) : null;
            if (s && e && !isNaN(s.getTime()) && !isNaN(e.getTime())) {
              return Math.max(0, (e.getTime() - s.getTime()) / 60000);
            }
            return null;
          })
          .filter((d: any) => d != null) as number[];

        if (durations.length > 0) {
          const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
          setAverageDurationMinutes(Math.round(avg));
        } else {
          setAverageDurationMinutes(null);
        }
      } catch (err) {
        setTotalBookings(0);
        setActiveBookings(0);
        setTotalSpent(0);
        setAverageDurationMinutes(null);
      }
      setLoading(false);
    }

    load();
  }, [user]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Account Analytics</h1>
          <p className="text-gray-600">A quick summary of your bookings and payments</p>
        </div>

        {loading ? (
          <div className="text-center py-8">Loading analytics...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl lg:text-3xl font-bold">{totalBookings}</div>
                  <div className="text-sm lg:text-base text-blue-100">Total Bookings</div>
                </div>
                <BarChart2 className="h-8 w-8 text-blue-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 rounded-lg text-white">
              <div className="flex items-center justify-between">
                <div>
            {/** format Total Spent to 3 decimal places and guard against NaN */}
            <div className="text-2xl lg:text-3xl font-bold">{`$${Number(totalSpent || 0).toFixed(3)}`}</div>
                  <div className="text-sm lg:text-base text-green-100">Total Spent</div>
                </div>
                <CreditCard className="h-8 w-8 text-green-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl lg:text-3xl font-bold">{activeBookings}</div>
                  <div className="text-sm lg:text-base text-purple-100">Active Bookings</div>
                </div>
                <Calendar className="h-8 w-8 text-purple-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-lg text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl lg:text-3xl font-bold">{averageDurationMinutes ?? '\u2014'}</div>
                  <div className="text-sm lg:text-base text-orange-100">Avg Duration (mins)</div>
                </div>
                <Clock className="h-8 w-8 text-orange-200" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
