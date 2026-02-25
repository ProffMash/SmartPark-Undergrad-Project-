import React, { useEffect, useMemo, useState } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { fetchPayments, Payment } from '../../API/paymentApi';
import { DollarSign, User, CheckCircle, Clock, XCircle, Download } from 'lucide-react';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { format } from 'date-fns';

export const PaymentManagement = (): React.ReactElement => {
  const { users } = useAppStore();
  const { user } = useAuthStore();
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStripePayments = async () => {
      setLoading(true);
      setError(null);
      try {
        // fetchPayments() fetches all payments from the API
        const paymentsFromApi = await fetchPayments();
        setPayments(paymentsFromApi);
      } catch (err: any) {
        setError('Failed to fetch Stripe payments');
      } finally {
        setLoading(false);
      }
    };
    loadStripePayments();
  }, []);

  // Pagination
  const ROWS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = Math.max(1, Math.ceil(payments.length / ROWS_PER_PAGE));

  // Only include completed payments with a valid transactionId
  // Only include completed payments with a valid transactionId that is NOT a session id (not starting with 'cs_')
  const filteredPayments = payments.filter(p => {
    return p.status === 'completed' && p.transactionId && typeof p.transactionId === 'string' && !p.transactionId.startsWith('cs_');
  });
  const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const formattedTotalRevenue = Number(totalRevenue || 0).toFixed(2);
  const pendingPayments = payments.filter(p => p.status === 'pending' && p.transactionId).length;
  const completedPayments = filteredPayments.length;

  // Sort payments by date (newest first)
  const sortedPayments = useMemo(() => {
    return [...filteredPayments].sort((a, b) => {
      const aDate = new Date(a.createdAt ?? a.paidAt ?? 0).getTime();
      const bDate = new Date(b.createdAt ?? b.paidAt ?? 0).getTime();
      return bDate - aDate; // newest first
    });
  }, [filteredPayments]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [payments.length, currentPage, totalPages]);

  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return sortedPayments.slice(start, start + ROWS_PER_PAGE);
  }, [sortedPayments, currentPage]);

  const getUser = (userId: number | string) => users.find(u => u.id === userId);

  const getStatusIcon = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Show loading / error states before rendering the page
  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[200px]">
          <FadeLoader color="#2563EB" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 text-center text-red-500">{error}</div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Stripe Payment Management</h1>
            <p className="text-gray-600">Monitor and manage all Stripe payment transactions</p>
          </div>
          <div className="flex items-center space-x-2">
            {user?.role !== 'operator' && (
              <>
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
                  onClick={() => exportFromStore('payments', { payments, users }, exportType)}
                  className="bg-white border px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export Payments</span>
                </button>
              </>
            )}
          </div>
        </div>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">KSh {formattedTotalRevenue}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{completedPayments}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{pendingPayments}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Payments Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Recent Stripe Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 table-header-group">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPayments.map((payment) => {
                  const user = getUser(payment.userId ?? '');
                  // Use normalized slotNumber from payment if available
                  const slotNumber = (payment as any).slotNumber ?? '';
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50 table-row border-b">
                      <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                        <div className="hidden">Transaction</div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{payment.transactionId}</div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                        <div className="hidden">User</div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">{user?.name || 'Unknown'}</div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                        <div className="hidden">Slot</div>
                        <div className="text-sm text-gray-900">{slotNumber ? `${slotNumber}` : 'N/A'}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                        <div className="hidden">Amount</div>
                        <div className="text-sm font-medium text-gray-900">KSh {payment.amount}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap">
                        <div className="hidden">Status</div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(payment.status)}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payment.status)}`}>{payment.status}</span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 table-cell whitespace-nowrap text-sm text-gray-500">
                        <div className="hidden">Date</div>
                        {format(new Date(payment.createdAt ?? payment.paidAt ?? new Date().toISOString()), 'MMM dd, yyyy, HH:mm')}
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
              Showing {(filteredPayments.length === 0) ? 0 : (filteredPayments.length > 0 && ((currentPage - 1) * ROWS_PER_PAGE + 1))} - {Math.min(currentPage * ROWS_PER_PAGE, filteredPayments.length)} of {filteredPayments.length}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-md text-sm ${currentPage === 1 ? 'text-gray-400 bg-gray-100' : 'text-gray-700 bg-white shadow-sm hover:bg-gray-50'}`}>Prev</button>
              <div className="hidden sm:flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded-md text-sm ${page === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{page}</button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-md text-sm ${currentPage === totalPages ? 'text-gray-400 bg-gray-100' : 'text-gray-700 bg-white shadow-sm hover:bg-gray-50'}`}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}