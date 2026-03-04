import React, { useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { AIChatbotModal } from './AIChatbotModal';

export const AIWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      {/* Floating Widget Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {/* Tooltip */}
        {isHovered && !isOpen && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-200">
            Chat with AI Assistant
            <div className="absolute bottom-0 right-4 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900" />
          </div>
        )}

        {/* Button */}
        <button
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={`
            group relative w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 
            text-white rounded-full shadow-lg hover:shadow-xl 
            flex items-center justify-center
            transform transition-all duration-300 
            hover:scale-110 active:scale-95
            ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
          `}
          aria-label="Open AI Chat Assistant"
        >
          {/* Pulse animation ring */}
          <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-30" />
          
          {/* Sparkle decoration */}
          <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300 drop-shadow-lg" />
          
          {/* Icon */}
          <MessageCircle className="w-6 h-6 relative z-10" />
        </button>
      </div>

      {/* Chatbot Modal */}
      <AIChatbotModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};
