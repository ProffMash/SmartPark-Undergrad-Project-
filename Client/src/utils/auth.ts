import { useAuthStore } from '../stores/authStore';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useAuthRedirect = () => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin/analytics', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);
};