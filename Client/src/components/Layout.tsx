import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Car, User, LogOut } from 'lucide-react';
import { NotificationCenter } from './NotificationCenter';

export const Layout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 shrink-0">
              <Link to="/" className="flex items-center space-x-2">
                <Car className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">SmartPark</span>
              </Link>
            </div>

            {/* Controls: always visible, compress on small screens */}
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
              {user ? (
                <>
                  <NotificationCenter />

                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {user.avatar ? (
                        <img src={user.avatar} alt="avatar" className="h-8 w-8 object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[6rem] sm:max-w-[10rem]">
                      {user.name}
                    </span>
                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full whitespace-nowrap flex-shrink-0">
                      {user.role}
                    </span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link to="/login" className="text-sm text-gray-600 hover:text-gray-800">Login</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {/* Mobile menu removed: controls are always visible and will compress on small screens */}

      <main>
        <Outlet />
      </main>
    </div>
  );
};