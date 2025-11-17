import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle, Clock, XCircle, Download, Archive } from 'lucide-react';
import { fetchPaymentHistory, Payment, updatePayment } from '../../API/paymentApi';
import { fetchBookingById } from '../../API/bookingApi';
import { fetchParkingSlotById } from '../../API/parkingSlotApi';
import { generatePaymentReceipt } from '../../utils/pdfGenerator';
import { format, isValid } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';

export const PaymentHistory: React.FC = () => {
  const { user } = useAuthStore();
  // allow an optional `archived` flag locally without changing API types
  type PaymentWithArchived = Payment & { archived?: boolean };
  const [userPayments, setUserPayments] = useState<PaymentWithArchived[]>([]);
  const [archivedPayments, setArchivedPayments] = useState<PaymentWithArchived[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 6;
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null); // payment id being generated

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        if (user?.id) {
          const payments = await fetchPaymentHistory(user.id);
          // Deduplicate payments by transactionId (fall back to id if missing)
          const uniquePayments = Array.from(
            new Map(
              payments.map(p => [p.transactionId ?? p.id, p])
            ).values()
          );
          // Exclude payments where transactionId starts with 'cs_' (session ID)
          const filteredPayments = uniquePayments.filter(p => {
            return p.transactionId && typeof p.transactionId === 'string' && !p.transactionId.startsWith('cs_');
          });
          // Separate archived and active payments. Cast to local extended type so
          // we can safely reference the optional `archived` flag added locally.
          const paymentsWith = filteredPayments as PaymentWithArchived[];
          setUserPayments(paymentsWith.filter(p => !p.archived));
          setArchivedPayments(paymentsWith.filter(p => p.archived));
        } else {
          setUserPayments([]);
          setArchivedPayments([]);
        }
      } catch (err) {
        setUserPayments([]);
        setArchivedPayments([]);
      }
      setLoading(false);
    }
    if (user) loadHistory();
    // reset to first page whenever the payments (or user) change
    return () => {
      setCurrentPage(1);
    };
  }, [user]);

  // compute pagination
  const paymentsToShow = showArchived ? archivedPayments : userPayments;
  const totalPages = Math.max(1, Math.ceil(paymentsToShow.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (current - 1) * PAGE_SIZE;
  const pagedPayments = paymentsToShow.slice(startIdx, startIdx + PAGE_SIZE);
  // Archive/unarchive handler (local only, for demo)
  const handleArchive = (id: string | number) => {
    // Persist archived state to backend (optimistic UI).
    const archiving = !showArchived; // if viewing active list, action archives
    const prevActive = userPayments;
    const prevArchived = archivedPayments;

    if (archiving) {
      // Archive: remove from active and add to archived (functional updates)
      setUserPayments(prev => {
        const next = prev.filter(p => p.id !== id);
        return next;
      });
      setArchivedPayments(prev => {
        const existing = prevActive.find(p => p.id === id);
        if (existing) return [...prev, { ...existing, archived: true }];
        return prev;
      });
    } else {
      // Unarchive: remove from archived and add back to active
      setArchivedPayments(prev => prev.filter(p => p.id !== id));
      setUserPayments(prev => {
        const existing = prevArchived.find(p => p.id === id);
        if (existing) return [...prev, { ...existing, archived: false }];
        return prev;
      });
    }

    (async () => {
      try {
        await updatePayment(id, { archived: archiving } as any);
      } catch (err) {
        // revert on error
        console.error('Failed to update archived state for payment', err);
        setUserPayments(prevActive);
        setArchivedPayments(prevArchived);
      }
    })();
  };

  const getStatusIcon = (status: string) => {
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

  const getStatusColor = (status: string) => {
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Payment History</h1>
            <p className="text-gray-600">View all your parking payment transactions</p>
          </div>
          <button
            className={`px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center space-x-2`}
            onClick={() => setShowArchived(a => !a)}
            aria-pressed={showArchived}
          >
            <Archive className="h-4 w-4" />
            <span>{showArchived ? 'Show Active' : 'Show Archived'}</span>
            {!showArchived && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-white text-purple-700">{archivedPayments.length}</span>
            )}
            {showArchived && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-white text-purple-700">{userPayments.length}</span>
            )}
          </button>
        </div>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : paymentsToShow.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Payments Found</h3>
            <p className="text-gray-600">{showArchived ? "No archived payments." : "You haven't made any payments yet."}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slot</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pagedPayments.map((payment) => {
                    const dateIso = payment.paidAt ?? payment.createdAt ?? null;
                    const d = dateIso ? new Date(dateIso) : null;
                    return (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="font-mono text-gray-900 break-all">{payment.transactionId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(payment.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>{payment.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.slotNumber ?? payment.slotId ?? '\u2014'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{d && isValid(d) ? format(d, 'MMM dd, yyyy p') : '\u2014'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${payment.amount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              className="inline-flex items-center px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
                              onClick={async () => {
                                if (generating) return;
                                setGenerating(String(payment.id));
                                try {
                                  const booking = payment.bookingId ? await fetchBookingById(payment.bookingId) : null;
                                  const slotIdToFetch = payment.slotId ?? (booking && (booking.slot_id ?? booking.slot_id) ? booking.slot_id : null);
                                  const slot = slotIdToFetch ? await fetchParkingSlotById(Number(slotIdToFetch)) : null;
                                  const userObj = user ?? { id: payment.userId, name: payment.userName ?? 'Unknown', email: '', phone: '', vehicleNumber: '', vehicleType: 'regular' };
                                  const success = await generatePaymentReceipt(payment as any, (booking as any) ?? ({} as any), (slot as any) ?? ({} as any), userObj as any);
                                  if (!success) console.error('Receipt generation failed for payment', payment.id);
                                } catch (e) {
                                  console.error('Error while generating receipt', e);
                                } finally {
                                  setGenerating(null);
                                }
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              <span>{generating === String(payment.id) ? 'Generating...' : 'Download'}</span>
                            </button>
                            <button
                              type="button"
                              className={`inline-flex items-center px-3 py-1.5 ${showArchived ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-200 hover:bg-gray-300'} text-sm rounded-md text-white transition-colors`}
                              onClick={() => handleArchive(payment.id)}
                            >
                              {showArchived ? 'Unarchive' : 'Archive'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination controls */}
            <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between sm:px-6">
              <div className="flex-1 flex items-center justify-start space-x-2 text-sm text-gray-700">
                <span>Showing</span>
                <span className="font-medium">{startIdx + 1}</span>
                <span>-</span>
                <span className="font-medium">{Math.min(startIdx + PAGE_SIZE, paymentsToShow.length)}</span>
                <span>of</span>
                <span className="font-medium">{paymentsToShow.length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={current === 1}
                  className={`px-3 py-1 rounded-md text-sm ${current === 1 ? 'bg-gray-200 text-gray-500' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
                >
                  Prev
                </button>
                <div className="hidden sm:flex items-center space-x-1">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-md text-sm ${page === current ? 'bg-purple-600 text-white' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
                        aria-current={page === current ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={current === totalPages}
                  className={`px-3 py-1 rounded-md text-sm ${current === totalPages ? 'bg-gray-200 text-gray-500' : 'bg-white border text-gray-700 hover:bg-gray-50'}`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};