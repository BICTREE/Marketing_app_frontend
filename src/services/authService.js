import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

// Centralized auth service — separate from the axios instance to avoid circular deps
const authService = {
  /**
   * Login user → POST /auth/login/
   * Stores tokens + user in localStorage
   */
  login: async (email, password) => {
    const res = await axios.post(`${BASE_URL}/auth/login/`, { email, password });
    if (res.data.require_otp) {
      return {
        require_otp: true,
        email,
        masked_email: res.data.masked_email,
        message: res.data.message
      };
    }
    const { access, refresh, user } = res.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    return { access, refresh, user };
  },

  /**
   * Verify OTP → POST /auth/verify-otp/
   */
  verifyOtp: async (email, otp) => {
    const res = await axios.post(`${BASE_URL}/auth/verify-otp/`, { email, otp });
    const { access, refresh, user } = res.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    return { access, refresh, user };
  },

  /**
   * Resend OTP → POST /auth/resend-otp/
   */
  resendOtp: async (email) => {
    const res = await axios.post(`${BASE_URL}/auth/resend-otp/`, { email });
    return res.data;
  },

  /**
   * Logout → POST /auth/logout/ (blacklist refresh token)
   */
  logout: async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        await axios.post(
          `${BASE_URL}/auth/logout/`,
          { refresh },
          { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
        );
      }
    } catch {
      // Fail silently — clear storage regardless
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },

  /**
   * Refresh access token → POST /auth/refresh/
   */
  refreshToken: async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) throw new Error('No refresh token');
    const res = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
    const { access, refresh: newRefresh } = res.data;
    localStorage.setItem('access_token', access);
    if (newRefresh) {
      localStorage.setItem('refresh_token', newRefresh);
    }
    return access;
  },

  /**
   * Get current user from localStorage
   */
  getCurrentUser: () => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated (access token present)
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  },

  /**
   * Get the logged-in user's role string
   */
  getUserRole: () => {
    const user = authService.getCurrentUser();
    return user?.role || null;
  },

  /**
   * Check if user has one of the required roles
   * @param {string[]} requiredRoles
   */
  hasPermission: (requiredRoles = []) => {
    const role = (authService.getUserRole() || '').toLowerCase();
    if (!role) return false;
    const req = requiredRoles.map(r => r.toLowerCase());
    return req.includes(role) || role === 'owner' || role === 'admin';
  },

  /**
   * Get the home route for a given role
   */
  getRoleDashboardPath: (role) => {
    const r = (role || '').toLowerCase();
    switch (r) {
      case 'admin':
      case 'owner':   return '/admin/dashboard';
      case 'manager':
      case 'sub_manager': return '/manager/dashboard';
      default:        return '/staff/dashboard';
    }
  },
};

export default authService;
