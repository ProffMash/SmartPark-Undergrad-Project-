import React, { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import { fetchBookingHistory, Booking, updateBooking } from '../../API/bookingApi';
import { useAuthStore } from '../../stores/authStore';
import { formatStoredDate } from '../../utils/timeUtils';

export const BookingHistory: React.FC = () => {
  const { user } = useAuthStore();
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  // Pagination
  const PAGE_SIZE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        if (user?.id) {
          const bookings = await fetchBookingHistory(user.id);
          setUserBookings(bookings);
          setCurrentPage(1); // reset to first page when new data loads
        } else {
          setUserBookings([]);
        }
      } catch (err) {
        setUserBookings([]);
      }
      setLoading(false);
    }
    if (user) loadHistory();
  }, [user]);

  // Reset page if list shrinks and currentPage is out of range
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(userBookings.length / PAGE_SIZE));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [userBookings, currentPage]);

  const handleCancelBooking = async (bookingId: number | string) => {
    // Optimistic UI update: mark booking as cancelled locally, then call API
    const prev = userBookings;
    try {
      setUserBookings((list) => list.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)));
      // Call API to persist cancellation
      await updateBooking(bookingId, { status: 'cancelled' } as any);
    } catch (err) {
      // revert UI on error and log
      setUserBookings(prev);
      console.error('Failed to cancel booking', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Booking History</h1>
          <p className="text-gray-600">View and manage your parking reservations</p>
        </div>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : userBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings Found</h3>
            <p className="text-gray-600 mb-6">You haven't made any parking reservations yet.</p>
            <button
              onClick={() => window.location.href = '/dashboard/book'}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Book Your First Slot
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userBookings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((booking) => {
                    const bAny = booking as any;
                    const slotDisplay = bAny?.slot?.slot_number ?? bAny?.slot_number ?? bAny?.slot_id ?? 'N/A';
                    // Use formatStoredDate below to show times exactly as stored in DB
                    return (
                      <tr key={booking.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{slotDisplay}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>{booking.start_time ? formatStoredDate(String(booking.start_time)) : '\u2014'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <span>{booking.end_time ? formatStoredDate(String(booking.end_time)) : '\u2014'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${booking.amount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {booking.status === 'active' ? (
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </button>
                          ) : booking.status === 'completed' ? (
                            <div className="inline-flex items-center text-green-600">
                              <CheckCircle className="h-5 w-5 mr-2" />
                              Completed
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination controls */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage >= Math.ceil(userBookings.length / PAGE_SIZE)}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing
                    <span className="font-medium"> {(userBookings.length === 0) ? 0 : (Math.min(currentPage * PAGE_SIZE, userBookings.length) - ((currentPage - 1) * PAGE_SIZE))} </span>
                    of
                    <span className="font-medium"> {userBookings.length} </span>
                    bookings
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.max(1, Math.ceil(userBookings.length / PAGE_SIZE)) }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        aria-current={page === currentPage}
                        className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium ${page === currentPage ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(Math.ceil(userBookings.length / PAGE_SIZE), p + 1))}
                      disabled={currentPage >= Math.ceil(userBookings.length / PAGE_SIZE)}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};