import React, { useEffect, useState, useRef } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { MessageSquare, Plus, Send, X, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { format, isValid } from 'date-fns';
import { fetchTickets, createTicket, fetchTicketMessages, sendTicketMessage, markMessagesAsRead, Ticket as ApiTicket, TicketMessage } from '../../API/ticketApi';

export const SupportTickets: React.FC = () => {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    message: ''
  });

  type LocalTicket = {
    id: number | string;
    userId: number | string;
    message: string;
    status: string;
    priority: string;
    response?: string | null;
    createdAt: string;
    updatedAt: string;
    unreadCount?: number;
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
        const myTickets = apiTickets
          .map(normalize)
          .filter(t => Number(t.userId) === user?.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Load unread counts for each ticket
        const ticketsWithUnread = await Promise.all(
          myTickets.map(async (ticket) => {
            try {
              const msgs = await fetchTicketMessages(ticket.id);
              // Count unread messages from admin/operator (not from the user)
              const unreadCount = msgs.filter(m => m.sender.role !== 'user' && !m.is_read).length;
              return { ...ticket, unreadCount };
            } catch {
              return { ...ticket, unreadCount: 0 };
            }
          })
        );
        if (mounted) setTickets(ticketsWithUnread);
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
    if (!selectedTicket || !user) return;
    let mounted = true;
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const msgs = await fetchTicketMessages(selectedTicket.id);
        if (mounted) setMessages(msgs);
        // Mark messages as read
        await markMessagesAsRead(selectedTicket.id, user.id, 'user');
        // Update local unread count
        setTickets(prev => prev.map(t => 
          t.id === selectedTicket.id ? { ...t, unreadCount: 0 } : t
        ));
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        if (mounted) setLoadingMessages(false);
      }
    };
    loadMessages();
    return () => { mounted = false; };
  }, [selectedTicket, user]);

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
        message: formData.message,
        priority: 'medium',
        status: 'open'
      } as any);

      const local = normalize(created);
      setTickets(prev => [local, ...prev]);
      setFormData({ message: '' });
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
          t.id === selectedTicket.id ? { ...t, status: 'in-progress' } : t
        ));
      }
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSendingMessage(false);
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

  // Chat Modal/Panel
  const ChatPanel = () => {
    if (!selectedTicket) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-white" />
                </button>
                {/* Support Avatar */}
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Support Team</h3>
                  <span className="text-xs text-blue-100">Online</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {/* Original ticket message */}
            <div className="flex justify-end items-end space-x-2">
              <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[75%] shadow-sm">
                <p className="text-sm">{selectedTicket.message}</p>
                <p className="text-xs text-blue-200 mt-1 text-right">
                  {(() => {
                    const d = selectedTicket.createdAt ? new Date(selectedTicket.createdAt) : null;
                    return d && isValid(d) ? format(d, 'MMM dd, yyyy HH:mm') : '—';
                  })()}
                </p>
              </div>
              {user?.avatar ? (
                <img src={user.avatar} alt="You" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-medium">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                </div>
              )}
            </div>

            {loadingMessages ? (
              <div className="flex justify-center py-4">
                <FadeLoader color="#2563EB" height={10} width={3} />
              </div>
            ) : (
              messages.map((msg) => {
                const isOwnMessage = String(msg.sender?.id) === String(user?.id);
                const senderInitial = msg.sender?.name?.charAt(0).toUpperCase() || '?';
                const roleColor = msg.sender?.role === 'admin' ? 'bg-purple-600' : msg.sender?.role === 'operator' ? 'bg-green-600' : 'bg-gray-500';
                
                return (
                  <div key={msg.id} className={`flex items-end space-x-2 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {/* Avatar */}
                    {msg.sender?.avatar ? (
                      <img 
                        src={msg.sender.avatar} 
                        alt={msg.sender?.name || 'User'} 
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isOwnMessage ? 'bg-blue-600' : roleColor}`}>
                        <span className="text-white text-xs font-medium">{senderInitial}</span>
                      </div>
                    )}
                    
                    {/* Message Bubble */}
                    <div className={`rounded-2xl px-4 py-2 max-w-[75%] shadow-sm ${
                      isOwnMessage 
                        ? 'bg-blue-600 text-white rounded-br-md' 
                        : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'
                    }`}>
                      {!isOwnMessage && (
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-xs font-semibold text-blue-600">
                            {msg.sender?.name || 'Support'}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            msg.sender?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                            msg.sender?.role === 'operator' ? 'bg-green-100 text-green-700' : 
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {msg.sender?.role || 'support'}
                          </span>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed">{msg.message}</p>
                      <p className={`text-[10px] mt-1 ${isOwnMessage ? 'text-blue-200 text-right' : 'text-gray-400'}`}>
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
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-3">
                {/* Current user avatar */}
                {user?.avatar ? (
                  <img src={user.avatar} alt="You" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-medium">{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                  </div>
                )}
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-blue-600 text-white p-2.5 rounded-full font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="Describe your issue..."
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
          <div className="bg-white rounded-xl shadow-lg divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <div 
                key={ticket.id} 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center space-x-4"
                onClick={() => setSelectedTicket(ticket)}
              >
                {/* Support Team Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                    <MessageSquare className="h-7 w-7 text-white" />
                  </div>
                  {/* Unread indicator */}
                  {(ticket.unreadCount ?? 0) > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">{ticket.unreadCount}</span>
                    </div>
                  )}
                </div>
                
                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className={`font-semibold truncate ${(ticket.unreadCount ?? 0) > 0 ? 'text-gray-900' : 'text-gray-700'}`}>Support Team</h3>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {(() => {
                        const d = ticket.updatedAt ? new Date(ticket.updatedAt) : null;
                        return d && isValid(d) ? format(d, 'MMM dd') : '—';
                      })()}
                    </span>
                  </div>
                  <p className={`text-sm truncate mb-1 ${(ticket.unreadCount ?? 0) > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                    {ticket.message.substring(0, 50)}{ticket.message.length > 50 ? '...' : ''}
                  </p>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex-shrink-0 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
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