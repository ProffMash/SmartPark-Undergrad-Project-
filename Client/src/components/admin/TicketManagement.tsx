import React, { useEffect, useState, useRef } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { MessageSquare, User, Clock, CheckCircle, AlertTriangle, Download, Send, X, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { format, isValid } from 'date-fns';
import { fetchTickets, updateTicket as apiUpdateTicket, fetchTicketMessages, sendTicketMessage, Ticket as ApiTicket, TicketMessage } from '../../API/ticketApi';

export const TicketManagement: React.FC = () => {
  const { users } = useAppStore();
  const { user: currentUser } = useAuthStore();
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');

  type LocalTicket = {
    id: number | string;
    userId: number | string;
    subject: string;
    message: string;
    status: 'open' | 'in-progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high';
    response?: string | null;
    createdAt: string;
    updatedAt: string;
  };

  const [tickets, setTickets] = useState<LocalTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [selectedTicket, setSelectedTicket] = useState<LocalTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const normalize = (t: ApiTicket): LocalTicket => ({
    id: t.id,
    userId: (t as any).user_id ?? (t as any).user?.id,
    subject: t.subject,
    message: t.message,
    status: t.status,
    priority: t.priority,
    response: t.response ?? null,
    createdAt: (t as any).created_at,
    updatedAt: (t as any).updated_at,
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiTickets = await fetchTickets();
        if (!mounted) return;
        const local = apiTickets.map(normalize).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTickets(local);
      } catch (err: any) {
        console.error('Failed to load tickets', err);
        setError(err?.message || 'Failed to load tickets');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Load messages when a ticket is selected
  useEffect(() => {
    if (!selectedTicket) return;
    let mounted = true;
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const msgs = await fetchTicketMessages(selectedTicket.id);
        if (mounted) setMessages(msgs);
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    };
    loadMessages();
    return () => { mounted = false; };
  }, [selectedTicket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getUser = (userId: number | string | undefined) => users.find(u => String(u.id) === String(userId));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'resolved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'closed':
        return <CheckCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusChange = async (ticketId: number | string, newStatus: LocalTicket['status'], e?: React.MouseEvent) => {
    e?.stopPropagation();
    // optimistic update
    setTickets(prev => prev.map(t => String(t.id) === String(ticketId) ? ({ ...t, status: newStatus } as LocalTicket) : t));
    if (selectedTicket && String(selectedTicket.id) === String(ticketId)) {
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null);
    }
    try {
      await apiUpdateTicket(ticketId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update ticket status', err);
      setError('Failed to update ticket status');
      try { const apiTickets = await fetchTickets(); setTickets(apiTickets.map(normalize)); } catch (_) {}
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !currentUser || !newMessage.trim()) return;
    
    setSendingMessage(true);
    try {
      const msg = await sendTicketMessage(selectedTicket.id, currentUser.id, newMessage.trim());
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
      // Update ticket status locally if it changed
      if (selectedTicket.status === 'open') {
        handleStatusChange(selectedTicket.id, 'in-progress');
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const openTickets = tickets.filter(t => t.status === 'open').length;
  const inProgressTickets = tickets.filter(t => t.status === 'in-progress').length;
  const resolvedTickets = tickets.filter(t => t.status === 'resolved').length;

  // Chat Modal/Panel
  const ChatPanel = () => {
    if (!selectedTicket) return null;
    const ticketUser = getUser(selectedTicket.userId);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedTicket.subject}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                      {selectedTicket.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority}
                    </span>
                    <span className="text-xs text-gray-500">
                      by {ticketUser?.name || 'Unknown User'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value as LocalTicket['status'])}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Original ticket message */}
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2 max-w-[80%]">
                <p className="text-xs font-medium mb-1 text-blue-600">
                  {ticketUser?.name || 'User'} (Original Message)
                </p>
                <p className="text-sm">{selectedTicket.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const d = selectedTicket.createdAt ? new Date(selectedTicket.createdAt) : null;
                    return d && isValid(d) ? format(d, 'MMM dd, yyyy HH:mm') : '—';
                  })()}
                </p>
              </div>
            </div>

            {loadingMessages ? (
              <div className="flex justify-center py-4">
                <FadeLoader color="#2563EB" height={10} width={3} />
              </div>
            ) : (
              messages.map((msg) => {
                const isAdminMessage = msg.sender?.role === 'admin' || msg.sender?.role === 'operator';
                return (
                  <div key={msg.id} className={`flex ${isAdminMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      isAdminMessage 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {!isAdminMessage && (
                        <p className="text-xs font-medium mb-1 text-blue-600">
                          {msg.sender?.name || 'User'}
                        </p>
                      )}
                      {isAdminMessage && (
                        <p className="text-xs font-medium mb-1 text-blue-200">
                          {msg.sender?.name || 'Support'} ({msg.sender?.role})
                        </p>
                      )}
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isAdminMessage ? 'text-blue-200' : 'text-gray-500'}`}>
                        {(() => {
                          const d = msg.created_at ? new Date(msg.created_at) : null;
                          return d && isValid(d) ? format(d, 'MMM dd, HH:mm') : '—';
                        })()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {selectedTicket.status !== 'closed' && (
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your response..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Ticket Management</h1>
            <p className="text-gray-600">Handle user support requests and issues</p>
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
              onClick={() => exportFromStore('tickets', { tickets }, exportType)}
              className="bg-white border px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Tickets</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{openTickets}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{inProgressTickets}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{resolvedTickets}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-100">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{tickets.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tickets List */}
        {loading && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 flex items-center justify-center min-h-[160px]">
            <FadeLoader color="#2563EB" />
          </div>
        )}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {tickets.map((ticket) => {
            const ticketUser = getUser(ticket.userId);
            
            return (
              <div 
                key={ticket.id} 
                className="bg-white rounded-xl shadow-lg p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0 mb-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                      {getStatusIcon(ticket.status)}
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">{ticket.subject}</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority} priority
                      </span>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <User className="h-3 w-3" />
                        <span>{ticketUser?.name || 'Unknown User'}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {(() => {
                          const d = ticket.createdAt ? new Date(ticket.createdAt) : null;
                          return d && isValid(d) ? format(d, 'MMM dd, yyyy HH:mm') : '—';
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(ticket.id, e.target.value as LocalTicket['status'], e as any)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-auto"
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    
                    <div className="flex items-center text-blue-600 p-2">
                      <MessageSquare className="h-4 w-4" />
                      <span className="ml-1 text-sm">Chat</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 leading-relaxed break-words line-clamp-2">{ticket.message}</p>
                </div>
              </div>
            );
          })}
        </div>

        {tickets.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Support Tickets</h3>
            <p className="text-gray-600">No support tickets have been created yet.</p>
          </div>
        )}

        <ChatPanel />
      </div>
    </div>
  );
};