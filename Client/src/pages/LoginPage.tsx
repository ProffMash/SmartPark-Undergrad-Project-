import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Lock, Eye, EyeOff, Mail } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { RegistrationModal } from '../components/RegistrationModal';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const { login, isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'admin' ? '/admin/analytics' : '/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const success = await login(email, password);

    if (!success) setError('Invalid email or password.');

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="hidden md:flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 p-10 text-white">
            <Car className="h-14 w-14 mb-4 opacity-95" />
            <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
            <p className="opacity-90">Sign in to manage your parking, bookings, and payments.</p>
            <div className="mt-6 text-sm opacity-90">New here?</div>
            <button onClick={() => setShowRegister(true)} className="mt-3 px-4 py-2 rounded-md bg-white text-blue-700 font-semibold hover:opacity-95">Create account</button>
          </div>

          <div className="p-8 md:p-12">
            <div className="mb-6">
              <h3 className="text-2xl font-semibold text-slate-800">Sign in to SmartPark</h3>
              <p className="mt-2 text-sm text-slate-500">Enter your email and password to continue</p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Email address</label>
                <div className="flex items-center border rounded-md px-3 py-2 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-300">
                  <Mail className="mr-2 text-slate-400" />
                  <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="outline-none w-full text-sm text-slate-700" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Password</label>
                <div className="flex items-center border rounded-md px-3 py-2 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-300">
                  <Lock className="mr-2 text-slate-400" />
                  <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Your password" className="outline-none w-full text-sm text-slate-700 pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input id="remember" type="checkbox" className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  <label htmlFor="remember" className="ml-2 text-sm text-slate-600">Remember me</label>
                </div>
                <button type="button" className="text-sm text-blue-600 hover:underline">Forgot password?</button>
              </div>

              <div>
                <button type="submit" disabled={isLoading} className="w-full px-4 py-3 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 flex items-center justify-center">
                  {isLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><Lock className="mr-2 h-4 w-4" />Sign in</>}
                </button>
              </div>

              <div className="text-center text-sm text-slate-500">
                Don't have an account? <button onClick={() => setShowRegister(true)} className="text-blue-600 font-medium hover:underline">Register here</button>
              </div>

              <div className="pt-4 text-center">
                <button type="button" onClick={() => navigate('/')} className="text-sm text-slate-600 px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200">Back Home</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <RegistrationModal isOpen={showRegister} onClose={() => setShowRegister(false)} />
    </div>
  );
};