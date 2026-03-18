import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  User, 
  MapPin, 
  CreditCard, 
  Users, 
  MessageSquare, 
  BarChart3,
  TrendingUp,
  Menu,
  X
} from 'lucide-react';
import { AdminProfile } from './admin/AdminProfile';
import { SlotManagement } from './admin/SlotManagement';
import { PaymentManagement } from './admin/PaymentManagement';
import { UserManagement } from './admin/UserManagement';
import { TicketManagement } from './admin/TicketManagement';
import { ContactManagement } from './admin/ContactManagement';
import { Analytics } from './admin/Analytics';
import { HeatmapAnalytics } from './admin/HeatMapAnalytics';
import { BookingManagement } from './admin/BookingManagement';

export const AdminDashboard: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const navigation = [
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Heatmap', href: '/admin/heatmap', icon: TrendingUp },
    { name: 'Slot Management', href: '/admin/slots', icon: MapPin },
    { name: 'User Management', href: '/admin/users', icon: Users },
    { name: 'Payment Management', href: '/admin/payments', icon: CreditCard },
    { name: 'Booking Management', href: '/admin/bookings', icon: Users },
    { name: 'Tickets', href: '/admin/tickets', icon: MessageSquare },
    { name: 'Profile', href: '/admin/profile', icon: User },
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
          <h2 className="text-lg lg:text-xl font-bold text-gray-900">Admin Dashboard</h2>
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
          <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
          <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/profile" element={<AdminProfile />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/heatmap" element={<HeatmapAnalytics />} />
            <Route path="/slots" element={<SlotManagement />} />
            <Route path="/payments" element={<PaymentManagement />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/tickets" element={<TicketManagement />} />
            <Route path="/contacts" element={<ContactManagement />} />
            <Route path="/bookings" element={<BookingManagement />} />
            <Route path="/" element={<Analytics />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};