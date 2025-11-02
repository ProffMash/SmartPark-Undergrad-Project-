import React, { useState, useEffect, useMemo } from 'react';

type BookingWithUsername = {
  username?: string;
  [key: string]: any;
};
import { Calendar, Clock, CheckCircle, XCircle, Edit3, Filter, Download } from 'lucide-react';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { format, isValid } from 'date-fns';
import { formatStoredDate } from '../../utils/timeUtils';

export const BookingManagement: React.FC = () => {
  // ...existing code...
  const { bookings, users, slots, updateBooking } = useAppStore();
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // booking ids in the store can be string or number, use null when none selected
  const [editingBooking, setEditingBooking] = useState<number | string | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');

  const getUser = (userId: number | string | undefined) => users.find(u => u.id === userId);
  const getSlot = (slotId: number | string | undefined) => slots.find(s => s.id === slotId);


  const filteredBookings = bookings.filter(booking => 
    statusFilter === 'all' || booking.status === statusFilter
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Pagination state and logic 
  const ROWS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / ROWS_PER_PAGE));

  // keep page in-range when filteredBookings changes
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredBookings.length, currentPage, totalPages]);

  // reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredBookings.slice(start, start + ROWS_PER_PAGE);
  }, [filteredBookings, currentPage]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-blue-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
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
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusUpdate = (bookingId: number | string) => {
    if (newStatus) {
      updateBooking(bookingId, { status: newStatus as any });
      setEditingBooking(null);
      setNewStatus('');
    }
  };

  const handleCancelBooking = (bookingId: number | string) => {
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      updateBooking(bookingId, { status: 'cancelled' });
    }
  };

  const activeBookings = bookings.filter(b => b.status === 'active').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Booking Management</h1>
            <p className="text-gray-600">Monitor and manage all parking reservations</p>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as 'csv'|'pdf')}
              className="text-sm border border-gray-300 rounded px-2 py-2"
              title="Export type"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={() => exportFromStore('bookings', { bookings, users, slots }, exportType)}
              className="bg-white border px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Bookings</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{activeBookings}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{completedBookings}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{cancelledBookings}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-600" />
              <span className="font-medium text-gray-900">Filter by Status:</span>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-auto"
            >
              <option value="all">All Bookings</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Bookings List */}
  {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings Found</h3>
            <p className="text-gray-600">
              {statusFilter === 'all' 
                ? 'No bookings have been made yet.' 
                : `No ${statusFilter} bookings found.`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedBookings.map((bookingRaw) => {
                    const booking = bookingRaw as BookingWithUsername;
                    const user = getUser(booking.userId);
                    const slot = getSlot(booking.slotId ?? booking.slot_id ?? booking.slotId);
                    const slotAny = slot as any;
                    const slotDisplay = (booking as any)?.slot?.slot_number ?? (booking as any)?.slot_number ?? slot?.number ?? slotAny?.slot_number ?? booking.slotId ?? booking.slot_id ?? 'N/A';
                    // We'll format start/end exactly as stored in DB (no timezone conversion)
                    const start = booking.start_time ? String(booking.start_time) : null;
                    const end = booking.end_time ? String(booking.end_time) : null;
                    const created = booking.created_at ?? booking.createdAt ?? booking.createdAt ? (new Date(booking.created_at ?? booking.createdAt)) : null;
                    return (
                      <tr key={booking.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Booking {String(booking.id).slice(-8)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          <div className="text-sm font-medium text-gray-900">{booking.username ? booking.username : (user?.name || 'Unknown User')}</div>
                          <div className="text-xs text-gray-500">{user?.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{slotDisplay}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{start ? formatStoredDate(start) : '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{end ? formatStoredDate(end) : '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking.amount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(booking.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>{booking.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{created && isValid(created as Date) ? format(created as Date, 'MMM dd, yyyy HH:mm') : '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {editingBooking === booking.id ? (
                            <div className="flex items-center justify-end space-x-2">
                              <select
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                              >
                                <option value="">Select Status</option>
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                              <button onClick={() => handleStatusUpdate(booking.id)} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors">Save</button>
                              <button onClick={() => { setEditingBooking(null); setNewStatus(''); }} className="bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-400 transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-2">
                              <button onClick={() => { setEditingBooking(booking.id); setNewStatus(booking.status); }} className="text-blue-600 hover:text-blue-700 transition-colors p-2 border border-blue-200 rounded-lg flex items-center justify-center space-x-1">
                                <Edit3 className="h-4 w-4" />
                                <span className="text-sm">Edit</span>
                              </button>
                              {booking.status === 'active' && (
                                <button onClick={() => handleCancelBooking(booking.id)} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors">Cancel</button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            <div className="px-4 sm:px-6 py-3 border-t bg-white flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {(filteredBookings.length === 0) ? 0 : ((currentPage - 1) * ROWS_PER_PAGE + 1)} - {Math.min(currentPage * ROWS_PER_PAGE, filteredBookings.length)} of {filteredBookings.length}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded-md text-sm ${currentPage === 1 ? 'text-gray-400 bg-gray-100' : 'text-gray-700 bg-white shadow-sm hover:bg-gray-50'}`}
                >Prev</button>
                <div className="hidden sm:flex items-center space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 rounded-md text-sm ${page === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >{page}</button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded-md text-sm ${currentPage === totalPages ? 'text-gray-400 bg-gray-100' : 'text-gray-700 bg-white shadow-sm hover:bg-gray-50'}`}
                >Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};