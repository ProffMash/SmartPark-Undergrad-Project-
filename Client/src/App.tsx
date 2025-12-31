import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import LandingPage from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { OperatorDashboard } from './components/operator/operatorDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';

function App() {
  const { isAuthenticated, user } = useAuthStore();

  // Request notification permission on app load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route 
            index 
            element={
              isAuthenticated && user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'operator' ? '/operator' : '/dashboard'} replace />
              ) : (
                <LandingPage />
              )
            } 
          />
          <Route 
            path="login" 
            element={
              isAuthenticated && user ? (
                <Navigate to={user.role === 'admin' ? '/admin' : user.role === 'operator' ? '/operator' : '/dashboard'} replace />
              ) : (
                <LoginPage />
              )
            } 
          />
          <Route path="payment-success" element={<PaymentSuccess />} />
          <Route
            path="dashboard/*"
            element={
              <ProtectedRoute requiredRole="user">
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/*"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="operator/*"
            element={
              <ProtectedRoute requiredRole="operator">
                <OperatorDashboard />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;