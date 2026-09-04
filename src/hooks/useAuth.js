import useAuthStore from '../store/authStore';
import authService from '../services/authService';
import { FLAG_FOR_CODE } from '../lib/permissions';

/**
 * useAuth — convenience hook exposing auth state + role helpers
 * 
 * Usage:
 *   const { user, isOwner, isManager, isStaff, hasRole, login, logout } = useAuth();
 */
const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, logout, verifyOtp, resendOtp } = useAuthStore();

  const role = (user?.role || '').toLowerCase();

  const isOwner = role === 'owner' || role === 'admin';
  const isManager = isOwner || role === 'manager';

  return {
    user,
    isAuthenticated,
    isLoading,

    // Role booleans
    isOwner,
    isManager,
    isStaff:    ['sub_manager', 'staff', 'telecaller', 'field_staff', 'custom'].includes(role),
    isTelecaller: role === 'telecaller',
    isField:    role === 'field_staff',

    /**
     * Check if the current user has one of the provided roles
     * @param {string[]} roles
     */
    hasRole: (roles = []) => {
      if (!role) return false;
      const rLower = roles.map(r => r.toLowerCase());
      return rLower.includes(role) || isOwner;
    },

    /**
     * Check if the current user has a specific permission capability
     * @param {string} permName (e.g. 'leads:view')
     */
    hasPermission: (permName) => {
      if (isOwner) return true;
      const allPerms = user?.all_permissions || [];
      if (allPerms.includes(permName)) return true;
      const flag = FLAG_FOR_CODE[permName];
      if (flag && user?.permissions?.[flag]) return true;
      return false;
    },

    /**
     * Login and return user object
     */
    login,

    /**
     * Logout (calls API + clears state)
     */
    verifyOtp,
    resendOtp,
    logout,

    /**
     * The dashboard path this user should land on after login
     */
    dashboardPath: authService.getRoleDashboardPath(role),
  };
};

export default useAuth;
