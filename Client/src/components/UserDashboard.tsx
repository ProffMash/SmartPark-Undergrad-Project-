import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { User, Calendar, MapPin, CreditCard, History, MessageSquare, Menu, X, BarChart2 } from 'lucide-react';
import { UserProfile } from './user/UserProfile';
import { Analytics } from './user/Analytics';
import { BookingPage } from './user/BookingPage';
import { MapView } from './user/MapView';
import { PaymentHistory } from './user/PaymentHistory';
import { BookingHistory } from './user/BookingHistory';
import { SupportTickets } from './user/SupportTickets';
import { useNotifications } from '../hooks/useNotifications';

export const UserDashboard: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  
  // Initialize notifications hook
  useNotifications();

  const navigation = [
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart2 },
    { name: 'Map View', href: '/dashboard/map', icon: MapPin },
    { name: 'Book Parking', href: '/dashboard/book', icon: Calendar },
    { name: 'Payment History', href: '/dashboard/payments', icon: CreditCard },
    { name: 'Booking History', href: '/dashboard/history', icon: History },
    { name: 'Support', href: '/dashboard/support', icon: MessageSquare },
    { name: 'Profile', href: '/dashboard/profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:transform-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between p-4 lg:p-6 border-b">
          <h2 className="text-lg lg:text-xl font-bold text-gray-900">User Dashboard</h2>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-4 lg:mt-6 pb-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center px-4 lg:px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-gray-600 hover:text-gray-900 p-1"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/payments" element={<PaymentHistory />} />
            <Route path="/history" element={<BookingHistory />} />
            <Route path="/support" element={<SupportTickets />} />
            <Route path="/" element={<Analytics />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};