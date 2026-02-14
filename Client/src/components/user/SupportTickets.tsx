import React, { useEffect, useState, useRef } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { MessageSquare, Plus, Clock, CheckCircle, AlertCircle, Send, X, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { format, isValid } from 'date-fns';
import { fetchTickets, createTicket, fetchTicketMessages, sendTicketMessage, Ticket as ApiTicket, TicketMessage } from '../../API/ticketApi';

export const SupportTickets: React.FC = () => {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    priority: 'medium' as 'low' | 'medium' | 'high'
  });

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
        const my = apiTickets
          .map(normalize)
          .filter(t => Number(t.userId) === user?.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTickets(my);
      } catch (err: any) {
        console.error('Failed to load tickets', err);
        setError(err?.message || 'Failed to load tickets');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    try {
      const created = await createTicket({
        user_id: user.id,
        subject: formData.subject,
        message: formData.message,
        priority: formData.priority,
        status: 'open'
      } as any);

      const local = normalize(created);
      setTickets(prev => [local, ...prev]);
      setFormData({ subject: '', message: '', priority: 'medium' });
      setShowForm(false);
    } catch (err: any) {
      console.error('Failed to create ticket', err);
      setError(err?.message || 'Failed to submit ticket');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !user || !newMessage.trim()) return;
    
    setSendingMessage(true);
    try {
      const msg = await sendTicketMessage(selectedTicket.id, user.id, newMessage.trim());
      setMessages(prev => [...prev, msg]);
      setNewMessage('');
      // Update ticket status locally if it changed
      if (selectedTicket.status === 'open') {
        setSelectedTicket(prev => prev ? { ...prev, status: 'in-progress' } : null);
        setTickets(prev => prev.map(t => 
          t.id === selectedTicket.id ? { ...t, status: 'in-progress' as const } : t
        ));
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'resolved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'closed':
        return <CheckCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
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

  // Chat Modal/Panel
  const ChatPanel = () => {
    if (!selectedTicket) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
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
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedTicket(null)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Original ticket message */}
            <div className="flex justify-end">
              <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                <p className="text-sm">{selectedTicket.message}</p>
                <p className="text-xs text-blue-200 mt-1">
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
                const isOwnMessage = String(msg.sender?.id) === String(user?.id);
                return (
                  <div key={msg.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      isOwnMessage 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {!isOwnMessage && (
                        <p className={`text-xs font-medium mb-1 ${isOwnMessage ? 'text-blue-200' : 'text-blue-600'}`}>
                          {msg.sender?.name || 'Support'} ({msg.sender?.role || 'admin'})
                        </p>
                      )}
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-200' : 'text-gray-500'}`}>
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
                  placeholder="Type your message..."
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
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Support Tickets</h1>
            <p className="text-gray-600">Get help with your parking experience</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <Plus className="h-5 w-5" />
            <span>New Ticket</span>
          </button>
        </div>

        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Support Ticket</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as 'low' | 'medium' | 'high' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    required
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex-1 text-center"
                  >
                    Submit Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400 transition-colors text-center"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-12 flex flex-col items-center justify-center min-h-[240px]">
            <FadeLoader color="#2563EB" />
            <h3 className="text-xl font-semibold text-gray-900 mt-4 mb-2">Loading Tickets...</h3>
            <p className="text-gray-600">Please wait while we fetch your support tickets.</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-md">
            <h3 className="text-lg font-semibold text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Support Tickets</h3>
            <p className="text-gray-600">You haven't created any support tickets yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {tickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="bg-white rounded-xl shadow-lg p-4 sm:p-6 cursor-pointer hover:shadow-xl transition-shadow"
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0 mb-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                      {getStatusIcon(ticket.status)}
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{ticket.subject}</h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority} priority
                      </span>
                      <span className="text-sm text-gray-500">
                        {(() => {
                          const d = ticket.createdAt ? new Date(ticket.createdAt) : null;
                          return d && isValid(d) ? format(d, 'MMM dd, yyyy') : '—';
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center text-blue-600">
                    <MessageSquare className="h-5 w-5" />
                    <span className="ml-2 text-sm font-medium">Open Chat</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700 leading-relaxed line-clamp-2">{ticket.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <ChatPanel />
      </div>
    </div>
  );
};