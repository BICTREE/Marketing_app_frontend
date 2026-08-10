import axios from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);


// ── Response Interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Skip interceptor if requested
    if (originalRequest?._skipInterceptor) {
      return Promise.reject(error);
    }

    const detail = error.response?.data?.detail || '';
    const code = error.response?.data?.code || '';

    // 401 → check single device session logout first
    if (error.response?.status === 401) {
      if (code === 'logged_in_elsewhere' || detail.toLowerCase().includes('another device')) {
        toast.error('⚠️ Logged out: Account was logged in on another device.', { id: 'single_device_logout', duration: 7000 });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (!originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (!refreshToken) throw new Error('No refresh token');

          const res = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh: refreshToken });
          const newAccess = res.data.access;
          const newRefresh = res.data.refresh;
          localStorage.setItem('access_token', newAccess);
          if (newRefresh) {
            localStorage.setItem('refresh_token', newRefresh);
          }
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
          originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
