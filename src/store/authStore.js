import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import authService from '../services/authService';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      // ── Setters ────────────────────────────────────────────────────────────
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),

      // ── Initialize on app mount (rehydrate from localStorage) ──────────────
      initializeAuth: () => {
        const user = authService.getCurrentUser();
        const isAuth = authService.isAuthenticated();
        set({ user: user || null, isAuthenticated: isAuth });
      },

      // ── Login ──────────────────────────────────────────────────────────────
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await authService.login(email, password);
          if (res.require_otp) {
            set({ isLoading: false });
            return res;
          }
          set({ user: res.user, isAuthenticated: true, isLoading: false });
          return res.user;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ── Verify OTP ─────────────────────────────────────────────────────────
      verifyOtp: async (email, otp) => {
        set({ isLoading: true });
        try {
          const { user } = await authService.verifyOtp(email, otp);
          set({ user, isAuthenticated: true, isLoading: false });
          return user;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      // ── Resend OTP ─────────────────────────────────────────────────────────
      resendOtp: async (email) => {
        return await authService.resendOtp(email);
      },

      // ── Logout ─────────────────────────────────────────────────────────────
      logout: async () => {
        await authService.logout();
        set({ user: null, isAuthenticated: false });
      },

      // ── Role helpers (derived from user.role) ──────────────────────────────
      get isOwner() {
        return get().user?.role === 'owner';
      },
      get isManager() {
        const role = get().user?.role;
        return role === 'owner' || role === 'manager';
      },
      get isStaff() {
        const role = get().user?.role;
        return ['sub_manager', 'staff', 'telecaller', 'field_staff', 'custom'].includes(role);
      },
      get roleDashboardPath() {
        return authService.getRoleDashboardPath(get().user?.role);
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user object + auth flag; tokens stay in localStorage separately
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;

