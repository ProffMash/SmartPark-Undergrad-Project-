import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { generateTextResponse, ChatMessage } from '../../API/GroqAIApi';

interface AIChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIChatbotModal: React.FC<AIChatbotModalProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm SmartPark AI Assistant. 🚗 I can help you with booking parking spots, understanding rates, navigating the app, and more. How can I assist you today?",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    // Clear immediately so the user can keep typing while waiting for a reply.
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await generateTextResponse(trimmedInput);
      const assistantMessage: ChatMessage = { role: 'assistant', content: response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Restore failed message only if the user has not typed a new draft yet.
      setInputValue((prev) => prev || trimmedInput);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "I'm sorry, I encountered an issue. Please try again in a moment.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const suggestedQuestions = [
    'How do I book a parking spot?',
    'What are the parking rates?',
    'How can I extend my booking?',
    'Where can I view my payment history?',
  ];

  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">SmartPark AI</h2>
              <p className="text-xs text-blue-100">Powered by Llama AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white shadow-sm border border-gray-100 rounded-tl-none'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white shadow-sm border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions (only show when few messages) */}
        {messages.length <= 2 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestedQuestion(question)}
                  className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 bg-gray-100 rounded-full border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="w-11 h-11 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
