import React, { useEffect, useState, useRef } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { MessageSquare, Download, Send, X, ArrowLeft, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { exportFromStore } from '../../utils/exportHelpers';
import { useAppStore } from '../../stores/appStore';
import { format, isValid } from 'date-fns';
import { fetchTickets, updateTicket as apiUpdateTicket, fetchTicketMessages, sendTicketMessage, markMessagesAsRead, softDeleteTicket, Ticket as ApiTicket, TicketMessage } from '../../API/ticketApi';

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

interface AdminChatPanelProps {
  selectedTicket: LocalTicket;
  ticketUser: any;
  messages: TicketMessage[];
  loadingMessages: boolean;
  newMessage: string;
  sendingMessage: boolean;
  onMessageChange: (msg: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onClose: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  currentUser: any;
  getStatusColor: (status: string) => string;
}

const AdminChatPanel: React.FC<AdminChatPanelProps> = ({
  selectedTicket,
  ticketUser,
  messages,
  loadingMessages,
  newMessage,
  sendingMessage,
  onMessageChange,
  onSendMessage,
  onClose,
  messagesEndRef,
  currentUser,
  getStatusColor,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="p-1 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              {/* User Avatar */}
              {(ticketUser as any)?.avatar ? (
                <img 
                  src={(ticketUser as any).avatar} 
                  alt={ticketUser?.name || 'User'} 
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                  <span className="text-white font-medium">{ticketUser?.name?.charAt(0).toUpperCase() || 'U'}</span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-white">{ticketUser?.name || 'Unknown User'}</h3>
                <span className="text-xs text-blue-100">Customer</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                {selectedTicket.status}
              </span>
              <button
                onClick={onClose}
                className="p-1 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {/* Original ticket message */}
          <div className="flex items-end space-x-2">
            {/* User Avatar */}
            {(ticketUser as any)?.avatar ? (
              <img 
                src={(ticketUser as any).avatar} 
                alt={ticketUser?.name || 'User'} 
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-medium">{ticketUser?.name?.charAt(0).toUpperCase() || 'U'}</span>
              </div>
            )}
            <div className="bg-white text-gray-900 rounded-2xl rounded-bl-md px-4 py-2 max-w-[75%] shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2 mb-1">
                <p className="text-xs font-semibold text-blue-600">
                  {ticketUser?.name || 'User'}
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  Original Message
                </span>
              </div>
              <p className="text-sm leading-relaxed">{selectedTicket.message}</p>
              <p className="text-[10px] text-gray-400 mt-1">
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
              const senderInitial = msg.sender?.name?.charAt(0).toUpperCase() || '?';
              const roleColor = msg.sender?.role === 'admin' ? 'bg-purple-600' : msg.sender?.role === 'operator' ? 'bg-green-600' : 'bg-gray-500';
              
              return (
                <div key={msg.id} className={`flex items-end space-x-2 ${isAdminMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* Avatar */}
                  {msg.sender?.avatar ? (
                    <img 
                      src={msg.sender.avatar} 
                      alt={msg.sender?.name || 'User'} 
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isAdminMessage ? roleColor : 'bg-gray-500'}`}>
                      <span className="text-white text-xs font-medium">{senderInitial}</span>
                    </div>
                  )}
                  
                  {/* Message Bubble */}
                  <div className={`rounded-2xl px-4 py-2 max-w-[75%] shadow-sm ${
                    isAdminMessage 
                      ? 'bg-blue-600 text-white rounded-br-md' 
                      : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'
                  }`}>
                    <div className="flex items-center space-x-2 mb-1">
                      <p className={`text-xs font-semibold ${isAdminMessage ? 'text-blue-100' : 'text-blue-600'}`}>
                        {msg.sender?.name || (isAdminMessage ? 'Support' : 'User')}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isAdminMessage 
                          ? 'bg-blue-500 text-blue-100' 
                          : msg.sender?.role === 'user' ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {msg.sender?.role || 'user'}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isAdminMessage ? 'text-blue-200 text-right' : 'text-gray-400'}`}>
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
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center space-x-3">
              {/* Current admin/operator avatar */}
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="You" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${currentUser?.role === 'admin' ? 'bg-purple-600' : 'bg-green-600'}`}>
                  <span className="text-white text-sm font-medium">{currentUser?.name?.charAt(0).toUpperCase() || 'A'}</span>
                </div>
              )}
              <input
                type="text"
                value={newMessage}
                onChange={(e) => onMessageChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !sendingMessage && newMessage.trim()) {
                    onSendMessage(e as any);
                  }
                }}
                placeholder="Type your response..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
              />
              <button
                onClick={() => {
                  if (newMessage.trim() && !sendingMessage) {
                    onSendMessage({ preventDefault: () => {} } as any);
                  }
                }}
                disabled={sendingMessage || !newMessage.trim()}
                className="bg-blue-600 text-white p-2.5 rounded-full font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const TicketManagement: React.FC = () => {
  const { users } = useAppStore();
  const { user: currentUser } = useAuthStore();
  const [exportType, setExportType] = useState<'csv'|'pdf'>('csv');

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
  const [deletedTicketIds, setDeletedTicketIds] = useState<Set<number | string>>(new Set());

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
        const localTickets = apiTickets.map(normalize).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Load unread counts for each ticket
        const ticketsWithUnread = await Promise.all(
          localTickets.map(async (ticket) => {
            try {
              const msgs = await fetchTicketMessages(ticket.id);
              // Count unread messages from users (not from admin/operator)
              const unreadCount = msgs.filter(m => m.sender.role === 'user' && !m.is_read).length;
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
  }, []);

  // Load messages when a ticket is selected
  useEffect(() => {
    if (!selectedTicket || !currentUser) return;
    let mounted = true;
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const msgs = await fetchTicketMessages(selectedTicket.id);
        if (mounted) setMessages(msgs);
        // Mark messages as read
        await markMessagesAsRead(selectedTicket.id, currentUser.id, currentUser.role);
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
  }, [selectedTicket, currentUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getUser = (userId: number | string | undefined) => users.find(u => String(u.id) === String(userId));

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

  const handleStatusChange = async (ticketId: number | string, newStatus: string, e?: React.MouseEvent) => {
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
    const messageToSend = newMessage.trim();
    if (!selectedTicket || !currentUser || !messageToSend) return;

    // Clear immediately so users can continue typing while this message is in flight.
    setNewMessage('');
    setSendingMessage(true);
    try {
      const msg = await sendTicketMessage(selectedTicket.id, currentUser.id, messageToSend);
      setMessages(prev => [...prev, msg]);
      // Update ticket status locally if it changed
      if (selectedTicket.status === 'open') {
        handleStatusChange(selectedTicket.id, 'in-progress');
      }
    } catch (err) {
      // Restore failed message only if the user has not typed a new draft yet.
      setNewMessage(prev => prev || messageToSend);
      console.error('Failed to send message', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteTicket = async (e: React.MouseEvent, ticketId: number | string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation from your view?')) {
      try {
        await softDeleteTicket(ticketId);
        setDeletedTicketIds(prev => new Set([...prev, ticketId]));
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket(null);
        }
      } catch (err) {
        console.error('Failed to delete ticket', err);
        alert('Failed to delete conversation');
      }
    }
  };

  // Chat Modal/Panel
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

        <div className="bg-white rounded-xl shadow-lg divide-y divide-gray-100">
          {tickets.filter(t => !deletedTicketIds.has(t.id)).map((ticket) => {
            const ticketUser = getUser(ticket.userId);
            
            return (
              <div 
                key={ticket.id} 
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center space-x-4 ${(ticket.unreadCount ?? 0) > 0 ? 'bg-blue-50/50' : ''}`}
                onClick={() => setSelectedTicket(ticket)}
              >
                {/* User Avatar */}
                <div className="relative flex-shrink-0">
                  {(ticketUser as any)?.avatar ? (
                    <img 
                      src={(ticketUser as any).avatar} 
                      alt={ticketUser?.name || 'User'} 
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                      <span className="text-white text-xl font-medium">{ticketUser?.name?.charAt(0).toUpperCase() || 'U'}</span>
                    </div>
                  )}
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
                    <div className="flex items-center space-x-2">
                      <h3 className={`font-semibold truncate ${(ticket.unreadCount ?? 0) > 0 ? 'text-gray-900' : 'text-gray-700'}`}>{ticketUser?.name || 'Unknown User'}</h3>
                      {(ticket.unreadCount ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500 text-white animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
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

                {/* Delete and Arrow */}
                <div className="flex-shrink-0 flex items-center space-x-2">
                  <button
                    onClick={(e) => handleDeleteTicket(e, ticket.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
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

        {selectedTicket && (
          <AdminChatPanel
            selectedTicket={selectedTicket}
            ticketUser={getUser(selectedTicket.userId)}
            messages={messages}
            loadingMessages={loadingMessages}
            newMessage={newMessage}
            sendingMessage={sendingMessage}
            onMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
            onClose={() => setSelectedTicket(null)}
            messagesEndRef={messagesEndRef}
            currentUser={currentUser}
            getStatusColor={getStatusColor}
          />
        )}
      </div>
    </div>
  );
};